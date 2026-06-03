import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import type { StoredFile } from './types.js';

function root(): string {
  return path.resolve(env.STORAGE_DIR);
}

export async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(root(), { recursive: true });
}

/**
 * Persiste un buffer sur disque sous `<STORAGE_DIR>/<sha256>.pdf`.
 */
export async function saveBufferLocal(buffer: Buffer): Promise<StoredFile> {
  await ensureStorageDir();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storageKey = `${sha256}.pdf`;
  const absolutePath = path.join(root(), storageKey);
  try {
    await fs.access(absolutePath);
  } catch {
    await fs.writeFile(absolutePath, buffer);
  }
  return { storageKey, sha256, bytes: buffer.length };
}

export async function readStoredFileLocal(storageKey: string): Promise<Buffer> {
  return fs.readFile(path.join(root(), storageKey));
}
