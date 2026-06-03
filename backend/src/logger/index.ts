import pino, { type LoggerOptions } from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

const options: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'vicinity-backend' },
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
};

if (isDev) {
  options.transport = {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
  };
}

export const logger = pino(options);
