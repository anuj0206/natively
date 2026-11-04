import { open } from 'node:fs/promises';
import path from 'node:path';
import { MAX_FILE_BYTES, readMarkdownFile } from '../../src/lib/markdownModes.mjs';

/** Only paths returned by the OS picker reach this reader; never renderer paths. */
async function readSelectedFile(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('Choose a Markdown file, not a folder.');
    if (stat.size > MAX_FILE_BYTES) throw new Error('The Markdown file must be at most 32 KB.');
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_FILE_BYTES) throw new Error('The Markdown file must be at most 32 KB.');
    return buffer.subarray(0, length);
  } finally { await handle.close(); }
}

export async function importMarkdownContext({ pickFile, readFile = readSelectedFile }) {
  const picked = await pickFile();
  if (picked.canceled || !picked.filePaths?.[0]) return { success: false, cancelled: true };
  const filePath = picked.filePaths[0];
  if (path.extname(filePath).toLowerCase() !== '.md') throw new Error('Choose a .md file.');
  const bytes = await readFile(filePath);
  const imported = await readMarkdownFile({
    name: path.basename(filePath), size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return { success: true, ...imported };
}
