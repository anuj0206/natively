export interface MarkdownMode { id: string; name: string; content: string; fileName: string }
export interface MarkdownModesState {
  presets: MarkdownMode[];
  activeId: string | null;
  applied: { generalId: string; originalContext: string; context: string } | null;
}
export interface MarkdownModesApi {
  modesGetAll(): Promise<Array<{ id: string; name: string; templateType: string; customContext: string }>>;
  modesGetActive(): Promise<{ id: string; customContext: string } | null>;
  modesSetActive(id: string | null): Promise<{ success: boolean; error?: string }>;
  modesUpdate(id: string, updates: { customContext: string }): Promise<{ success: boolean; error?: string }>;
}
export const MARKDOWN_MODES_KEY: string;
export const MAX_CONTEXT_CHARS: number;
export const MAX_FILE_BYTES: number;
export function validateMarkdown(name: unknown, content: unknown): void;
export function readMarkdownFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<{ name: string; fileName: string; content: string }>;
export function loadMarkdownModes(storage: Storage): MarkdownModesState;
export function saveMarkdownMode(storage: Storage, preset: MarkdownMode): MarkdownModesState;
export function applyMarkdownMode(storage: Storage, api: MarkdownModesApi, id: string | null): Promise<MarkdownModesState>;
export function deleteMarkdownMode(storage: Storage, api: MarkdownModesApi, id: string): Promise<MarkdownModesState>;
