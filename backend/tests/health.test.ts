import request from 'supertest';
import { createApp } from '../src/http/app';

interface HealthBody {
  status: string;
  uptime: number;
}

describe('GET /healthz', () => {
  const app = createApp();

  it('returns 200 with status ok and a numeric uptime', async () => {
    const res = await request(app).get('/healthz');
    const body = res.body as HealthBody;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.uptime).toBe('number');
  });
});
