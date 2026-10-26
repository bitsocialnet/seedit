import fs from 'fs';
import os from 'os';
import path from 'path';
import { crc32 } from 'zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractZipEntry } from './before-pack.js';

const unixRegularFile = 0o100755;
const unixSymlink = 0o120777;

// builds an uncompressed zip whose entries carry unix modes, like the ones Kubo's release tooling writes
const buildZip = (entries) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data, mode = unixRegularFile } of entries) {
    const nameBuffer = Buffer.from(name);
    const content = Buffer.from(data);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(10, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, nameBuffer, content);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + content.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
};

describe('extractZipEntry', () => {
  let tempDir;
  let archivePath;
  let outputPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedit-before-pack-'));
    archivePath = path.join(tempDir, 'kubo.zip');
    outputPath = path.join(tempDir, 'out', 'kubo', 'ipfs.exe');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes only the requested entry to the chosen path', async () => {
    fs.writeFileSync(
      archivePath,
      buildZip([
        { name: 'kubo/LICENSE', data: 'license' },
        { name: 'kubo/ipfs.exe', data: 'kubo binary' },
      ]),
    );

    await extractZipEntry(archivePath, 'kubo/ipfs.exe', outputPath);

    expect(fs.readFileSync(outputPath, 'utf8')).toBe('kubo binary');
    expect(fs.readdirSync(path.dirname(outputPath))).toEqual(['ipfs.exe']);
  });

  it('rejects a symlink entry instead of creating it', async () => {
    fs.writeFileSync(archivePath, buildZip([{ name: 'kubo/ipfs.exe', data: '/etc/passwd', mode: unixSymlink }]));

    await expect(extractZipEntry(archivePath, 'kubo/ipfs.exe', outputPath)).rejects.toThrow('is not a regular file');
    expect(fs.existsSync(path.dirname(outputPath))).toBe(false);
  });

  it('rejects an archive with a path traversal entry and writes nothing', async () => {
    fs.writeFileSync(
      archivePath,
      buildZip([
        { name: '../escaped.txt', data: 'escaped' },
        { name: 'kubo/ipfs.exe', data: 'kubo binary' },
      ]),
    );

    await expect(extractZipEntry(archivePath, 'kubo/ipfs.exe', outputPath)).rejects.toThrow('invalid relative path');
    expect(fs.existsSync(path.join(tempDir, '..', 'escaped.txt'))).toBe(false);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('fails when the archive has no such entry', async () => {
    fs.writeFileSync(archivePath, buildZip([{ name: 'kubo/README.md', data: 'readme' }]));

    await expect(extractZipEntry(archivePath, 'kubo/ipfs.exe', outputPath)).rejects.toThrow('kubo/ipfs.exe not found');
  });
});
