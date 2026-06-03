import crypto from 'node:crypto';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { logger } from '../logger/index.js';
import type { StoredFile } from './types.js';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.MINIO_ENDPOINT,
      region: env.MINIO_REGION,
      credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY,
        secretAccessKey: env.MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

function objectKey(storageKey: string): string {
  return storageKey.startsWith('documents/') ? storageKey : `documents/${storageKey}`;
}

export async function ensureMinioBucket(): Promise<void> {
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
    return;
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404 && status !== 403) {
      throw err;
    }
  }

  await s3.send(new CreateBucketCommand({ Bucket: env.MINIO_BUCKET }));
  logger.info({ bucket: env.MINIO_BUCKET }, 'minio bucket created');
}

export async function checkMinioHealth(): Promise<boolean> {
  try {
    await getClient().send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
    return true;
  } catch {
    return false;
  }
}

export async function saveBufferMinio(buffer: Buffer): Promise<StoredFile> {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storageKey = `${sha256}.pdf`;
  const key = objectKey(storageKey);
  const s3 = getClient();

  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }));
    return { storageKey, sha256, bytes: buffer.length };
  } catch {
    // objet absent — upload
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.MINIO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      Metadata: { sha256 },
    }),
  );

  return { storageKey, sha256, bytes: buffer.length };
}

export async function readStoredFileMinio(storageKey: string): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: env.MINIO_BUCKET,
      Key: objectKey(storageKey),
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error('empty_object');
  }

  return Buffer.from(await body.transformToByteArray());
}
