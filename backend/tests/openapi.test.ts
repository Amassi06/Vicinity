import request from 'supertest';
import { createApp } from '../src/http/app';

describe('OpenAPI docs', () => {
  it('serves the spec from /openapi.yaml', async () => {
    const app = createApp();

    const res = await request(app).get('/openapi.yaml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/yaml');
    expect(res.text).toContain('openapi: 3.0.3');
    expect(res.text).toContain('Vicinity API');
  });
});
