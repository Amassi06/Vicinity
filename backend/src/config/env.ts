import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z
    .string()
    .url()
    .default(
      'postgresql://cn_app:cn_dev_password@localhost:55432/connected_neighbours?schema=public',
    ),
  MONGO_URL: z
    .string()
    .url()
    .default(
      'mongodb://cn_root:cn_dev_password@localhost:57017/connected_neighbours?authSource=admin',
    ),
  NEO4J_URL: z.string().url().default('bolt://localhost:57687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('cn_dev_password'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('dev-access-secret-change-me-in-prod-please-32chars+'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('dev-refresh-secret-change-me-in-prod-please-32chars+'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('vicinity'),
  STORAGE_BACKEND: z.enum(['local', 'minio']).optional(),
  STORAGE_DIR: z.string().default('./storage/documents'),
  STORAGE_MAX_PDF_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  STORAGE_MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  MINIO_ENDPOINT: z.string().url().default('http://localhost:59000'),
  MINIO_ACCESS_KEY: z.string().min(1).default('cn_minio'),
  MINIO_SECRET_KEY: z.string().min(1).default('cn_dev_password'),
  MINIO_BUCKET: z.string().min(1).default('vicinity-documents'),
  MINIO_REGION: z.string().default('us-east-1'),
  WELCOME_BONUS_POINTS: z.coerce.number().int().min(0).default(100),
  DESKTOP_LATEST_VERSION: z.string().default('1.0.0'),
  DESKTOP_DOWNLOAD_URL: z.string().default('https://example.com/vicinity-desktop.jar'),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
