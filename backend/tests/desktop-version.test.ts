import request from 'supertest';
import { createApp } from '../src/http/app';

describe('Desktop version check', () => {
  const app = createApp();

  it('GET /desktop/latest-version is public and returns version info', async () => {
    const res = await request(app).get('/desktop/latest-version');
    expect(res.status).toBe(200);
    const body = res.body as { version: string; downloadUrl: string };
    expect(typeof body.version).toBe('string');
    expect(typeof body.downloadUrl).toBe('string');
  });
});
