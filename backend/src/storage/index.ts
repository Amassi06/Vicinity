import { env } from '../config/env.js';
import { logger } from '../logger/index.js';
import {
  ensureStorageDir,
  readStoredFileLocal,
  saveBufferLocal,
} from './local.js';
import {
  checkMinioHealth,
  ensureMinioBucket,
  readStoredFileMinio,
  saveBufferMinio,
} from './minio.js';
import type { StoredFile } from './types.js';

export type StorageBackend = 'local' | 'minio';

export function activeStorageBackend(): StorageBackend {
  if (env.STORAGE_BACKEND) {
    return env.STORAGE_BACKEND;
  }
  if (env.NODE_ENV === 'test') {
    return 'local';
  }
  return 'minio';
}

export async function initStorage(): Promise<void> {
  const backend = activeStorageBackend();
  if (backend === 'minio') {
    await ensureMinioBucket();
    logger.info(
      { bucket: env.MINIO_BUCKET, endpoint: env.MINIO_ENDPOINT },
      'document storage: minio',
    );
  } else {
    await ensureStorageDir();
    logger.info({ dir: env.STORAGE_DIR }, 'document storage: local filesystem');
  }
}

export async function saveBuffer(buffer: Buffer): Promise<StoredFile> {
  if (activeStorageBackend() === 'minio') {
    return saveBufferMinio(buffer);
  }
  return saveBufferLocal(buffer);
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  if (activeStorageBackend() === 'minio') {
    return readStoredFileMinio(storageKey);
  }
  return readStoredFileLocal(storageKey);
}

export async function checkStorageHealth(): Promise<boolean> {
  if (activeStorageBackend() === 'minio') {
    return checkMinioHealth();
  }
  try {
    await ensureStorageDir();
    return true;
  } catch {
    return false;
  }
}

export type { StoredFile } from './types.js';
