import request from 'supertest';
import { createApp } from '../src/http/app.js';
import { prisma } from '../src/db/prisma.js';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection.js';
import { PollModel } from '../src/db/mongo/models/poll.model.js';
import { VoteModel } from '../src/db/mongo/models/vote.model.js';

const TIMEOUT_MS = 25_000;
const EMAIL = `__polls__${Date.now()}@example.com`;
const NH_ID = '00000000-0000-4000-8000-000000000099';

describe('Polls with plugins', () => {
  const app = createApp();
  let accessToken = '';
  let userId = '';
  let pollId = '';

  beforeAll(async () => {
    await prisma.$connect();
    await connectMongo();
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (pollId) {
      await VoteModel.deleteMany({ pollId });
      await PollModel.deleteMany({ _id: pollId });
    }
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await disconnectMongo();
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('lists plugins and creates poll with min-three-options', async () => {
    const signup = await request(app)
      .post('/auth/signup')
      .send({ email: EMAIL, password: 'password12345', displayName: 'Poll Tester' });
    accessToken = (signup.body as { accessToken: string }).accessToken;
    userId = (signup.body as { user: { id: string } }).user.id;

    const plugins = await request(app)
      .get('/plugins')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(plugins.status).toBe(200);
    expect(plugins.body.polls.length).toBeGreaterThanOrEqual(2);

    const created = await request(app)
      .post('/polls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        neighbourhoodId: NH_ID,
        title: 'Test plugin',
        options: ['A', 'B', 'C'],
        pluginId: 'min-three-options',
      });
    expect(created.status).toBe(201);
    pollId = String((created.body as { _id: string })._id);

    const fail = await request(app)
      .post('/polls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        neighbourhoodId: NH_ID,
        title: 'Should fail',
        options: ['A', 'B'],
        pluginId: 'min-three-options',
      });
    expect(fail.status).toBe(422);
  });
});
