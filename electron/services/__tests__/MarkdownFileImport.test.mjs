import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importMarkdownContext } from '../markdownFileImport.mjs';

async function fixture(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'markdown-picker-'));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
const choose = file => async () => ({ canceled: false, filePaths: [file] });

test('native picker imports actual UTF-8 Markdown from a Unicode path with spaces', async () => fixture(async dir => {
  const file = path.join(dir, 'My résumé.MD');
  await writeFile(file, '# Context\nSpeak clearly.\n中文');
  assert.deepEqual(await importMarkdownContext({ pickFile: choose(file) }), {
    success: true, name: 'My résumé', fileName: 'My résumé.MD', content: '# Context\nSpeak clearly.\n中文',
  });
}));
test('cancelling never reads a file', async () => {
  const result = await importMarkdownContext({ pickFile: async () => ({ canceled: true, filePaths: [] }), readFile: async () => assert.fail('unexpected read') });
  assert.deepEqual(result, { success: false, cancelled: true });
});
test('only Markdown files are read', async () => {
  await assert.rejects(importMarkdownContext({ pickFile: choose('wrong.exe'), readFile: async () => assert.fail('unexpected read') }), /\.md/);
});
test('excessive byte and character counts are rejected rather than truncated', async () => fixture(async dir => {
  const file = path.join(dir, 'large.md');
  await writeFile(file, 'a'.repeat(32001));
  await assert.rejects(importMarkdownContext({ pickFile: choose(file) }), /32 KB/);
  await writeFile(file, 'a'.repeat(8001));
  await assert.rejects(importMarkdownContext({ pickFile: choose(file) }), /8,000/);
}));
test('invalid UTF-8, folders and empty context are rejected', async () => fixture(async dir => {
  const file = path.join(dir, 'bad.md');
  await writeFile(file, Buffer.from([255]));
  await assert.rejects(importMarkdownContext({ pickFile: choose(file) }), /UTF-8/);
  await writeFile(file, '  ');
  await assert.rejects(importMarkdownContext({ pickFile: choose(file) }), /empty/);
  const folder = path.join(dir, 'folder.md');
  await mkdir(folder);
  await assert.rejects(importMarkdownContext({ pickFile: choose(folder) }));
}));
test('read and dialog errors propagate for a visible UI message', async () => {
  await assert.rejects(importMarkdownContext({ pickFile: choose('missing.md'), readFile: async () => { throw new Error('Cannot open file'); } }), /Cannot open file/);
  await assert.rejects(importMarkdownContext({ pickFile: async () => { throw new Error('Picker failed'); } }), /Picker failed/);
});
