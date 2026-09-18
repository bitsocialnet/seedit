import test from 'node:test';
import assert from 'node:assert/strict';
import { createJevClient, validateResponse, JEV_ENDPOINT } from '../client.mjs';

const model = 'jev-1.13.0';
const questions = { decision: { type: 'choice', instructions: 'Assess', criteria: { yes: 'Yes', no: 'No' } } };
const response = () => ({
  model,
  answers: { decision: { type: 'choice', choice: 'yes', confidence: 0.9, probabilities: { yes: 0.9, no: 0.1 } } },
  usage: { input_tokens: 100, output_tokens: 5 },
});
const options = (extra = {}) => ({ live: true, apiKey: 'fixture-key', model, fetchImpl: async () => Response.json(response()), ...extra });

test('typed request uses the fixed official endpoint; response contains no arbitrary provider fields', async () => {
  const client = createJevClient(
    options({
      fetchImpl: async (url, init) => {
        assert.equal(url, JEV_ENDPOINT);
        assert.equal(init.redirect, 'error');
        assert.equal(init.headers.Authorization, 'Bearer fixture-key');
        assert.deepEqual(JSON.parse(init.body).questions, questions);
        return Response.json({ ...response(), echoedSecret: 'do-not-return' });
      },
    }),
  );
  const result = await client.ask({ state: 'fixture', questions });
  assert.equal(result.answers.decision.choice, 'yes');
  assert.equal(result.echoedSecret, undefined);
  assert.equal(client.stats().inputTokens, 100);
  assert.equal(client.stats().usageMissing, 0);
});

for (const [name, mutate] of Object.entries({
  'wrong model': (data) => {
    data.model = 'jev-latest';
  },
  'unoffered choice': (data) => {
    data.answers.decision.choice = 'execute';
  },
  'missing probability': (data) => {
    delete data.answers.decision.probabilities.no;
  },
  'extra probability': (data) => {
    data.answers.decision.probabilities.maybe = 0;
  },
  'invalid sum': (data) => {
    data.answers.decision.probabilities.no = 0.9;
  },
  'nonmax choice': (data) => {
    data.answers.decision.choice = 'no';
  },
  'invalid confidence': (data) => {
    data.answers.decision.confidence = null;
  },
  'missing type': (data) => {
    delete data.answers.decision.type;
  },
  'extra answer': (data) => {
    data.answers.other = data.answers.decision;
  },
}))
  test(`rejects ${name}`, () => {
    const data = response();
    mutate(data);
    assert.throws(() => validateResponse(data, questions, model), /invalid_response/);
  });

test('help/offline default, missing credentials and aliases never fetch', async () => {
  let called = 0;
  for (const config of [{ live: false }, { apiKey: '' }, { model: 'jev-preview' }]) {
    const client = createJevClient(
      options({
        ...config,
        fetchImpl: async () => {
          called++;
        },
      }),
    );
    await assert.rejects(client.ask({ state: 'x', questions }));
  }
  assert.equal(called, 0);
});

test('request, byte, secret and spend guards stop before network', async () => {
  const client = createJevClient(options({ maxRequests: 1 }));
  await client.ask({ state: 'x', questions });
  await assert.rejects(client.ask({ state: 'x', questions }), /budget_exhausted/);
  await assert.rejects(createJevClient(options({ maxInputBytes: 10 })).ask({ state: 'x', questions }), /input_too_large/);
  await assert.rejects(createJevClient(options({ maxCostUsd: 0.000001 })).ask({ state: 'x', questions }), /budget_exhausted/);
  await assert.rejects(createJevClient(options()).ask({ state: 'fixture-key', questions }), /secret_in_input/);
  await assert.rejects(createJevClient(options({ apiKey: ' fixture-key \n' })).ask({ state: 'fixture-key', questions }), /secret_in_input/);
});

test('throttling and invalid/error payloads cannot leak provider content or count as free', async () => {
  const client = createJevClient(options({ fetchImpl: async () => new Response('private fixture-key data', { status: 429 }) }));
  await assert.rejects(client.ask({ state: 'x', questions }), (error) => error.message === 'provider_throttled');
  assert.equal(client.stats().usageMissing, 1);
  assert.equal(client.stats().estimatedCostUsd, null);
  assert.equal(client.stats().knownCostSubtotalUsd, 0);
  assert.ok(client.stats().reservedMaxCostUsd > 0);
  await assert.rejects(createJevClient(options({ fetchImpl: async () => new Response('{bad fixture-key') })).ask({ state: 'x', questions }), /provider_unavailable/);
});

test('oversized streamed provider response is bounded', async () => {
  const client = createJevClient(options({ fetchImpl: async () => new Response('x'.repeat(256001)) }));
  await assert.rejects(client.ask({ state: 'x', questions }), /response_too_large/);
});

test('missing usage is unknown, not zero billed', async () => {
  const client = createJevClient(
    options({
      fetchImpl: async () => {
        const data = response();
        delete data.usage;
        return Response.json(data);
      },
    }),
  );
  await client.ask({ state: 'x', questions });
  assert.equal(client.stats().usageMissing, 1);
  assert.equal(client.stats().estimatedCostUsd, null);
});
