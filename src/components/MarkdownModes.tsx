import { useEffect, useRef, useState } from 'react';
import {
  MARKDOWN_MODES_KEY, MAX_CONTEXT_CHARS, applyMarkdownMode, deleteMarkdownMode,
  loadMarkdownModes, readMarkdownFile, saveMarkdownMode,
  type MarkdownMode, type MarkdownModesState,
} from '../lib/markdownModes.mjs';

const CHANGE_EVENT = 'personal-markdown-modes-changed';

/** Standalone personal presets; the original premium mode editor stays intact. */
export function MarkdownModes({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<MarkdownModesState>({ presets: [], activeId: null, applied: null });
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState<MarkdownMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
  const refreshGeneration = useRef(0);

  async function refresh() {
    const generation = ++refreshGeneration.current;
    try {
      const saved = loadMarkdownModes(localStorage);
      setState(saved);
      const active = await window.electronAPI?.modesGetActive();
      if (generation !== refreshGeneration.current) return;
      setSelected(active?.id === saved.applied?.generalId && active?.customContext === saved.applied?.context ? saved.activeId ?? '' : '');
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => {
    void refresh();
    const storage = (e: StorageEvent) => { if (e.key === MARKDOWN_MODES_KEY) void refresh(); };
    const changed = () => { void refresh(); };
    window.addEventListener('storage', storage);
    window.addEventListener(CHANGE_EVENT, changed);
    const unsubscribe = window.electronAPI?.onModeChanged?.(changed);
    return () => {
      refreshGeneration.current++;
      window.removeEventListener('storage', storage);
      window.removeEventListener(CHANGE_EVENT, changed);
      unsubscribe?.();
    };
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try {
      // Serialize changes from the launcher and overlay, which share this origin.
      if (navigator.locks) await navigator.locks.request('personal-markdown-modes', action);
      else await action();
      window.dispatchEvent(new Event(CHANGE_EVENT));
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const api = () => {
    if (!window.electronAPI) throw new Error('Markdown modes require the desktop app.');
    return window.electronAPI;
  };
  const field = 'w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm';
  const button = 'rounded-lg border border-current/20 px-3 py-1.5 text-xs disabled:opacity-40';

  return (
    <section aria-label="Markdown modes" className={compact ? 'no-drag px-3 py-1 text-xs' : 'space-y-4 p-5 text-text-primary'}>
      {!compact && <div><h2 className="text-lg font-semibold">Markdown modes</h2>
        <p className="mt-1 text-sm opacity-65">Attach a .md file with the background and instructions you want the AI to use. These personal presets use General-mode context.</p></div>}
      <div className="flex items-center gap-2">
        <label htmlFor={compact ? 'markdown-overlay-mode' : 'markdown-manager-mode'} className="shrink-0">{compact ? 'MD mode' : 'Active mode'}</label>
        <select id={compact ? 'markdown-overlay-mode' : 'markdown-manager-mode'} className={field} value={selected} disabled={busy || !!draft}
          onChange={e => { const id = e.target.value || null; void run(async () => { await applyMarkdownMode(localStorage, api(), id); }); }}>
          <option value="">None / restore original context</option>
          {state.presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {compact && <button type="button" className={button + ' shrink-0'} aria-expanded={managerOpen}
          onClick={() => setManagerOpen(open => !open)}>{managerOpen ? 'Close editor' : 'Add / edit'}</button>}
        {!compact && <button className={button} disabled={busy || !!draft} onClick={() => setDraft({ id: crypto.randomUUID(), name: '', content: '', fileName: '' })}>New mode</button>}
      </div>
      {compact && managerOpen && <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-lg border border-current/20"><MarkdownModes /></div>}
      {!compact && !draft && state.presets.length === 0 && <p className="text-sm opacity-60">No Markdown modes yet. Create one and attach a file.</p>}
      {!compact && !draft && state.presets.map(p => <div key={p.id} className="flex items-center gap-3 rounded-xl border border-current/15 p-3">
        <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.name}</div><div className="truncate text-xs opacity-60">{p.fileName || 'Written context'} · {p.content.length.toLocaleString()} characters</div></div>
        <button className={button} disabled={busy} onClick={() => void run(async () => { await applyMarkdownMode(localStorage, api(), p.id); })}>Use</button>
        <button className={button} disabled={busy} onClick={() => setDraft({ ...p })}>Edit</button>
        <button className={button} disabled={busy} onClick={() => {
          if (window.confirm(`Delete Markdown mode “${p.name}”?`)) void run(async () => { await deleteMarkdownMode(localStorage, api(), p.id); });
        }}>Delete</button>
      </div>)}
      {!compact && draft && <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          saveMarkdownMode(localStorage, draft);
          await applyMarkdownMode(localStorage, api(), draft.id);
          setDraft(null);
          setNotice('Mode saved and active. Its context will be used for your next answer.');
        });
      }}>
        <label className="block text-sm">Mode name<input required autoFocus maxLength={100} className={field + ' mt-1'} value={draft.name} disabled={busy} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block text-sm">Attach Markdown file
          <input type="file" accept=".md,text/markdown" disabled={busy} className="mt-1 block w-full text-sm" onChange={e => {
            const file = e.target.files?.[0]; e.target.value = '';
            if (file) void run(async () => { const imported = await readMarkdownFile(file); setDraft({ ...draft, ...imported, name: draft.name.trim() || imported.name }); });
          }} />
        </label>
        {draft.fileName && <p className="text-xs opacity-60">Attached copy: {draft.fileName}. Reattach to import later file changes.</p>}
        <label className="block text-sm">Context<textarea rows={9} className={field + ' mt-1 resize-y'} value={draft.content} disabled={busy} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label>
        <p className="text-xs opacity-60">{draft.content.length.toLocaleString()} / {MAX_CONTEXT_CHARS.toLocaleString()} characters. Stored on this device and included in AI requests when selected.</p>
        <div className="flex gap-2"><button type="submit" className={button} disabled={busy || !draft.name.trim() || !draft.content.trim()}>Save and use</button>
          <button type="button" className={button} disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
      </form>}
      {!compact && <p className="text-xs opacity-55">Switching context cancels in-progress answers. Modes persist across restarts. Clear the selection to restore the original General context.</p>}
      {busy && <p role="status">Updating…</p>}
      {notice && <p role="status" className="text-xs">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
