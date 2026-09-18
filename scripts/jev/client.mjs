// Development-only client. Never import this module into application code.
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const INPUT_USD_PER_MILLION = 0.042;

export class JevError extends Error {
  constructor(code) {
    super(code);
    this.name = 'JevError';
    this.code = code;
  }
}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (code) => {
  throw new JevError(code);
};
const probability = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function validateQuestions(questions) {
  if (!object(questions) || Object.keys(questions).length < 1 || Object.keys(questions).length > 20) fail('invalid_questions');
  for (const [id, question] of Object.entries(questions)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(id) ||
      !object(question) ||
      question.type !== 'choice' ||
      typeof question.instructions !== 'string' ||
      question.instructions.length > 4000 ||
      !object(question.criteria)
    )
      fail('invalid_questions');
    const choices = Object.keys(question.criteria);
    if (
      choices.length < 2 ||
      choices.length > 50 ||
      choices.some((key) => !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || typeof question.criteria[key] !== 'string' || question.criteria[key].length > 2000)
    )
      fail('invalid_questions');
  }
}

export function validateResponse(data, questions, model) {
  if (!object(data) || data.model !== model || !object(data.answers) || Object.keys(data.answers).length !== Object.keys(questions).length) fail('invalid_response');
  const answers = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = data.answers[id];
    const choices = Object.keys(question.criteria);
    if (
      !object(answer) ||
      answer.type !== 'choice' ||
      !choices.includes(answer.choice) ||
      !probability(answer.confidence) ||
      !object(answer.probabilities) ||
      Object.keys(answer.probabilities).length !== choices.length ||
      choices.some((choice) => !probability(answer.probabilities[choice]))
    )
      fail('invalid_response');
    const values = choices.map((choice) => answer.probabilities[choice]);
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.001 || answer.probabilities[answer.choice] < Math.max(...values)) fail('invalid_response');
    answers[id] = {
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: Object.fromEntries(choices.map((choice) => [choice, answer.probabilities[choice]])),
    };
  }
  const usage = {};
  for (const field of ['input_tokens', 'output_tokens']) {
    const value = data.usage?.[field];
    if (Number.isSafeInteger(value) && value >= 0) usage[field] = value;
  }
  return { model, answers, usage };
}

async function readBoundedJson(response) {
  if (!response.body) fail('invalid_response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) fail('response_too_large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export function createJevClient({
  live = false,
  apiKey = process.env.TYPESAFE_API_KEY,
  model = process.env.JEV_MODEL,
  maxRequests = 20,
  maxCalls = maxRequests,
  maxInputBytes = 60_000,
  maxInputTokens = 300_000,
  maxCostUsd = 0.02,
  timeoutMs = 8000,
  deadlineMs = 120_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (
    ![maxCalls, maxInputBytes, maxInputTokens, timeoutMs, deadlineMs].every((n) => Number.isSafeInteger(n) && n > 0) ||
    maxCalls > 1000 ||
    maxInputBytes > 128_000 ||
    timeoutMs > 30_000 ||
    deadlineMs > 600_000 ||
    !Number.isFinite(maxCostUsd) ||
    maxCostUsd <= 0 ||
    maxCostUsd > 10
  )
    fail('invalid_limits');
  const started = Date.now();
  const totals = { requests: 0, inputTokens: 0, outputTokens: 0, usageMissing: 0, reservedInputTokens: 0 };
  function stats() {
    const knownCostSubtotalUsd = (totals.inputTokens * INPUT_USD_PER_MILLION) / 1e6;
    return {
      ...totals,
      knownCostSubtotalUsd,
      estimatedCostUsd: totals.usageMissing ? null : knownCostSubtotalUsd,
      reservedMaxCostUsd: (totals.reservedInputTokens * INPUT_USD_PER_MILLION) / 1e6,
      priceUsdPerMillionInputTokens: INPUT_USD_PER_MILLION,
    };
  }
  async function ask({ state, questions }) {
    if (!live) fail('live_not_enabled');
    if (typeof apiKey !== 'string' || !apiKey.trim()) fail('missing_api_key');
    const token = apiKey.trim();
    // Explicit versions make evaluations reproducible; aliases cannot silently change underneath a cache.
    if (typeof model !== 'string' || !/^jev-\d+\.\d+\.\d+$/.test(model)) fail('pinned_model_required');
    validateQuestions(questions);
    let body;
    try {
      body = JSON.stringify({ model, state, questions });
    } catch {
      fail('invalid_state');
    }
    if (body.includes(token)) fail('secret_in_input');
    const bytes = Buffer.byteLength(body);
    if (bytes > maxInputBytes) fail('input_too_large');
    // Reserve one token per UTF-8 byte plus framing, including failed calls. This is deliberately
    // conservative, not a billing guarantee; actual usage remains separate and may be unavailable.
    const reserved = bytes + 1024;
    if (
      totals.requests >= maxCalls ||
      totals.reservedInputTokens + reserved > maxInputTokens ||
      ((totals.reservedInputTokens + reserved) * INPUT_USD_PER_MILLION) / 1e6 > maxCostUsd
    )
      fail('budget_exhausted');
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining <= 0) fail('deadline_exceeded');
    totals.requests++;
    totals.usageMissing++;
    totals.reservedInputTokens += reserved;
    const before = Date.now();
    try {
      const response = await fetchImpl(JEV_ENDPOINT, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) fail(response.status === 429 ? 'provider_throttled' : `provider_http_${response.status}`);
      const result = validateResponse(await readBoundedJson(response), questions, model);
      if (result.usage.input_tokens !== undefined) {
        totals.inputTokens += result.usage.input_tokens;
        totals.usageMissing--;
      }
      totals.outputTokens += result.usage.output_tokens || 0;
      return { ...result, latencyMs: Date.now() - before };
    } catch (error) {
      if (error instanceof JevError) throw error;
      fail(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable');
    }
  }
  return { ask, stats };
}
