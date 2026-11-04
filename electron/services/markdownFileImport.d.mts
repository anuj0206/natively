export interface MarkdownImportResult {
  success: boolean; cancelled?: boolean; error?: string;
  name?: string; fileName?: string; content?: string;
}
export function importMarkdownContext(deps: {
  pickFile: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  readFile?: (path: string) => Promise<Uint8Array>;
}): Promise<MarkdownImportResult>;
