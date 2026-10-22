// Personal Markdown presets for the public, editable General-mode context.
// No premium APIs, entitlement changes, embeddings, or file-path access.
export const MARKDOWN_MODES_KEY = 'natively.personalMarkdownModes.v1';
export const MAX_CONTEXT_CHARS = 8000;
export const MAX_FILE_BYTES = 32000;

export function validateMarkdown(name, content) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('Enter a mode name (up to 100 characters).');
  if (typeof content !== 'string' || !content.trim()) throw new Error('The Markdown context is empty.');
  if (content.includes('\0')) throw new Error('Choose a UTF-8 text Markdown file.');
  if (content.length > MAX_CONTEXT_CHARS) throw new Error('Context must be at most 8,000 characters. Shorten the file; it will not be silently truncated.');
}

export async function readMarkdownFile(file) {
  if (!file || !/\.md$/i.test(file.name)) throw new Error('Choose a .md file.');
  if (file.size > MAX_FILE_BYTES) throw new Error('The Markdown file must be at most 32 KB.');
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('The file must contain valid UTF-8 text.'); }
  const name = file.name.replace(/\.md$/i, '');
  validateMarkdown(name, content);
  return { name, fileName: file.name, content };
}

export function loadMarkdownModes(storage) {
  const raw = storage.getItem(MARKDOWN_MODES_KEY);
  if (!raw) return { presets: [], activeId: null, applied: null };
  let state;
  try { state = JSON.parse(raw); } catch { throw new Error('Saved Markdown modes could not be read. Your data has not been overwritten.'); }
  if (!state || !Array.isArray(state.presets) || state.presets.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.content !== 'string')
      || (state.activeId !== null && typeof state.activeId !== 'string')
      || (state.applied !== null && (!state.applied || typeof state.applied.generalId !== 'string' || typeof state.applied.originalContext !== 'string' || typeof state.applied.context !== 'string'))) {
    throw new Error('Saved Markdown modes are invalid. Your data has not been overwritten.');
  }
  return state;
}

function persist(storage, state) {
  storage.setItem(MARKDOWN_MODES_KEY, JSON.stringify(state));
  return state;
}

export function saveMarkdownMode(storage, preset) {
  if (!preset || typeof preset.id !== 'string' || !preset.id) throw new Error('Invalid Markdown mode ID.');
  validateMarkdown(preset.name, preset.content);
  const state = loadMarkdownModes(storage);
  const saved = { id: preset.id, name: preset.name.trim(), content: preset.content, fileName: preset.fileName || '' };
  const exists = state.presets.some(p => p.id === saved.id);
  if (!exists && state.presets.length >= 50) throw new Error('You can save up to 50 Markdown modes.');
  state.presets = exists ? state.presets.map(p => p.id === saved.id ? saved : p) : [...state.presets, saved];
  return persist(storage, state);
}

function check(result) {
  if (!result?.success) throw new Error(result?.error || 'Natively could not apply the context.');
}

/** Runs through the existing IPC APIs so switching still cancels stale answers. */
export async function applyMarkdownMode(storage, api, id) {
  const state = loadMarkdownModes(storage);
  const preset = id === null ? null : state.presets.find(p => p.id === id);
  if (id !== null && !preset) throw new Error('This Markdown mode no longer exists.');
  if (preset) validateMarkdown(preset.name, preset.content);
  const modes = await api.modesGetAll();
  const general = modes.find(m => m.templateType === 'general' && m.name === 'General') ?? modes.find(m => m.templateType === 'general');
  if (!general) throw new Error('Natively has no General mode available.');
  const previous = await api.modesGetActive();
  // If the built-in editor changed the context, leave that edit intact on clear.
  const ownsContext = state.applied?.generalId === general.id && state.applied.context === general.customContext;
  if (!preset && !ownsContext) return persist(storage, { ...state, activeId: null, applied: null });
  const originalContext = ownsContext ? state.applied.originalContext : general.customContext;
  const context = preset ? preset.content : originalContext;
  // Ensure storage is writable before mutating the running app.
  persist(storage, state);
  check(await api.modesSetActive(null));
  try {
    check(await api.modesUpdate(general.id, { customContext: context }));
    check(await api.modesSetActive(general.id));
    return persist(storage, {
      ...state, activeId: preset?.id ?? null,
      applied: preset ? { generalId: general.id, originalContext, context } : null,
    });
  } catch (error) {
    // Restore the original state if an IPC request or disk write failed.
    const restored = await api.modesUpdate(general.id, { customContext: general.customContext });
    const activated = await api.modesSetActive(previous?.id ?? null);
    if (!restored?.success || !activated?.success) throw new Error('Could not apply or fully restore the previous mode. Check Natively’s active mode before continuing.');
    throw error;
  }
}

export async function deleteMarkdownMode(storage, api, id) {
  let state = loadMarkdownModes(storage);
  if (state.activeId === id) state = await applyMarkdownMode(storage, api, null);
  return persist(storage, { ...state, presets: state.presets.filter(p => p.id !== id) });
}
