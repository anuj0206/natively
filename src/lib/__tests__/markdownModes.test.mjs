import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMarkdownMode, deleteMarkdownMode, loadMarkdownModes, MARKDOWN_MODES_KEY, readMarkdownFile, saveMarkdownMode } from '../markdownModes.mjs';

function fixture() {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const general = { id: 'g', name: 'General', templateType: 'general', customContext: 'Original instructions' };
  let active = general;
  const calls = [];
  const api = {
    modesGetAll: async () => [{ ...general }],
    modesGetActive: async () => active ? { ...active } : null,
    modesUpdate: async (id, patch) => { assert.equal(id, 'g'); Object.assign(general, patch); calls.push(['update', patch.customContext]); return { success: true }; },
    modesSetActive: async id => { active = id ? general : null; calls.push(['active', id]); return { success: true }; },
  };
  return { storage, api, general, calls, values };
}
const a = { id: 'a', name: 'Planning', fileName: 'planning.md', content: '# Project\nBuild accessible tools.\nUse concise answers.' };
const b = { id: 'b', name: 'Study', fileName: 'study.md', content: '# Study\nUse geometry examples.' };

test('imports UTF-8 Markdown without truncation; rejects invalid type, encoding, empty and excessive content', async () => {
  const file = (name, content) => ({ name, size: Buffer.byteLength(content), arrayBuffer: async () => new TextEncoder().encode(content).buffer });
  assert.equal((await readMarkdownFile(file('Résumé.MD', a.content))).content, a.content);
  await assert.rejects(readMarkdownFile(file('a.exe', a.content)), /\.md/);
  await assert.rejects(readMarkdownFile(file('a.md', ' ')), /empty/);
  await assert.rejects(readMarkdownFile(file('a.md', 'x'.repeat(8001))), /8,000/);
  await assert.rejects(readMarkdownFile(file('a.md', 'x'.repeat(32001))), /32 KB/);
  await assert.rejects(readMarkdownFile({ name: 'bad.md', size: 1, arrayBuffer: async () => new Uint8Array([255]).buffer }), /UTF-8/);
});

test('presets persist, select through normal IPC and restore the original General context', async () => {
  const { storage, api, general, calls } = fixture();
  saveMarkdownMode(storage, a); saveMarkdownMode(storage, b);
  await applyMarkdownMode(storage, api, a.id);
  assert.equal(loadMarkdownModes(storage).activeId, 'a');
  assert.equal(general.customContext, a.content);
  assert.deepEqual(calls.slice(0, 3), [['active', null], ['update', a.content], ['active', 'g']]);
  await applyMarkdownMode(storage, api, b.id);
  assert.equal(general.customContext, b.content);
  await applyMarkdownMode(storage, api, null);
  assert.equal(general.customContext, 'Original instructions');
  assert.equal(loadMarkdownModes(storage).activeId, null);
  assert.equal(loadMarkdownModes(storage).presets.length, 2);
});

test('editing and deleting an active preset can restore the exact original context', async () => {
  const { storage, api, general } = fixture();
  saveMarkdownMode(storage, a);
  await applyMarkdownMode(storage, api, 'a');
  saveMarkdownMode(storage, { ...a, content: 'Updated context' });
  await applyMarkdownMode(storage, api, 'a');
  assert.equal(general.customContext, 'Updated context');
  await deleteMarkdownMode(storage, api, 'a');
  assert.equal(general.customContext, 'Original instructions');
  assert.equal(loadMarkdownModes(storage).presets.length, 0);
});

test('failed activation rolls back context and preserves selected metadata', async () => {
  const { storage, api, general } = fixture();
  saveMarkdownMode(storage, a);
  const activate = api.modesSetActive;
  let fail = true;
  api.modesSetActive = async id => {
    if (id === 'g' && fail) { fail = false; return { success: false, error: 'test refusal' }; }
    return activate(id);
  };
  await assert.rejects(applyMarkdownMode(storage, api, 'a'), /test refusal/);
  assert.equal(general.customContext, 'Original instructions');
  assert.equal(loadMarkdownModes(storage).activeId, null);
});

test('clearing never overwrites context edited outside the Markdown editor', async () => {
  const { storage, api, general } = fixture();
  saveMarkdownMode(storage, a);
  await applyMarkdownMode(storage, api, 'a');
  general.customContext = 'External edit';
  await applyMarkdownMode(storage, api, null);
  assert.equal(general.customContext, 'External edit');
});

test('bad storage and disk errors preserve data and prevent context mutation', async () => {
  const { storage, api, values, calls } = fixture();
  values.set(MARKDOWN_MODES_KEY, 'broken');
  assert.throws(() => loadMarkdownModes(storage), /not been overwritten/);
  assert.equal(values.get(MARKDOWN_MODES_KEY), 'broken');
  values.clear(); saveMarkdownMode(storage, a);
  storage.setItem = () => { throw new Error('Disk full'); };
  await assert.rejects(applyMarkdownMode(storage, api, 'a'), /Disk full/);
  assert.equal(calls.length, 0);
});
