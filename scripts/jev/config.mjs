// Developer-machine configuration only. Never import this module into application code.
import { constants, openSync, closeSync, fstatSync, readSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const loadedKeys = new Set();
export class JevConfigError extends Error {
  constructor(code) {
    super(code);
    this.name = 'JevConfigError';
    this.code = code;
  }
}
const fail = (code) => {
  throw new JevConfigError(code);
};

function readSmallFile(file, code, optional = false) {
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) fail(code);
    const buffer = Buffer.alloc(16_385);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > 16_384) fail(code);
    return buffer.subarray(0, length).toString('utf8');
  } catch (error) {
    if (optional && error.code === 'ENOENT') return undefined;
    fail(code);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function resolveJevSettings({ apiKey, model, env = process.env, home = os.homedir() } = {}) {
  let key = apiKey ?? env.TYPESAFE_API_KEY;
  let selectedModel = model ?? env.JEV_MODEL;
  const keyFile = key === undefined ? env.TYPESAFE_API_KEY_FILE : undefined;
  let config = {};
  // Explicit runtime credentials and model do not depend on this machine's config.
  if ((key === undefined && keyFile === undefined) || selectedModel === undefined) {
    const explicit = env.JEV_CONFIG_FILE !== undefined;
    const file = explicit ? env.JEV_CONFIG_FILE : path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'bitsocial', 'jev.json');
    if (!file || !path.isAbsolute(file)) fail('invalid_config_path');
    const raw = readSmallFile(file, 'config_unreadable', !explicit);
    if (raw !== undefined) {
      try {
        config = JSON.parse(raw);
      } catch {
        fail('invalid_config');
      }
      if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some((k) => !['apiKeyFile', 'model'].includes(k))) fail('invalid_config');
    }
  }
  selectedModel ??= config.model;
  if (typeof selectedModel !== 'string' || !/^jev-\d+\.\d+\.\d+$/.test(selectedModel)) fail('pinned_model_required');
  if (key === undefined) {
    const file = keyFile ?? config.apiKeyFile;
    if (file !== undefined) {
      if (typeof file !== 'string' || !path.isAbsolute(file)) fail('invalid_api_key_file');
      key = readSmallFile(file, 'api_key_file_unreadable');
    }
  }
  if (typeof key !== 'string' || !key.trim()) fail('missing_api_key');
  key = key.trim();
  if (key.length > 8192 || /\s|[\x00-\x1f\x7f]/u.test(key)) fail('invalid_api_key');
  loadedKeys.add(key);
  return { apiKey: key, model: selectedModel };
}

export function redactJevSecrets(value) {
  let result = String(value);
  for (const key of [...loadedKeys, process.env.TYPESAFE_API_KEY?.trim()]) {
    if (key) result = result.split(key).join('[redacted]');
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--check') {
    console.log('Usage: node scripts/jev/config.mjs --check (checks local credentials and pinned model; no network)');
    process.exitCode = process.argv.includes('--help') ? 0 : 2;
  } else {
    try {
      const { model } = resolveJevSettings();
      console.log(JSON.stringify({ ready: true, model, networkCalls: 0 }));
    } catch (error) {
      console.log(JSON.stringify({ ready: false, reason: error instanceof JevConfigError ? error.code : 'configuration_unavailable', networkCalls: 0 }));
      process.exitCode = 2;
    }
  }
}
