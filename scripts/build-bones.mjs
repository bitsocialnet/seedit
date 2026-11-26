#!/usr/bin/env node
// Captures the modern feed's loading skeleton from a running dev server with boneyard, into src/data/bones.
// Run it after changing the post card layout. BONES_URL picks the server; extra arguments go to boneyard,
// e.g. `yarn bones:build --cdp 9222` to use a running Chrome instead of Playwright's.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const url = process.env.BONES_URL || 'https://seedit.localhost/#/';
const out = 'src/data/bones';
const args = ['build', url, '--no-scan', '--breakpoints', '375,768,1024,1280', '--wait', '2000', '--out', out, '--force', ...process.argv.slice(2)];

console.log(`[bones] capturing from ${url} into ${out}`);
const result = spawnSync('boneyard-js', args, { stdio: 'inherit', shell: process.platform === 'win32' });
// the skeleton imports its bones JSON directly, so boneyard's global registry is not used
rmSync(`${out}/registry.ts`, { force: true });
process.exit(result.status ?? 1);
