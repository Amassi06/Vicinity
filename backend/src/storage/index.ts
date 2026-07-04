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
  // En environnement de test, on force le stockage local : le SDK AWS/minio
  // échoue sous Jest+ts-jest (import dynamique ESM impossible sans
  // --experimental-vm-modules), donc NODE_ENV=test doit toujours l'emporter
  // sur un STORAGE_BACKEND=minio hérité du .env partagé avec le mode dev.
  if (env.NODE_ENV === 'test') {
    return 'local';
  }
  if (env.STORAGE_BACKEND) {
    return env.STORAGE_BACKEND;
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
