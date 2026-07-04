import request from 'supertest';
import { createApp } from '../src/http/app.js';
import { prisma } from '../src/db/prisma.js';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection.js';
import { PollModel } from '../src/db/mongo/models/poll.model.js';
import { VoteModel } from '../src/db/mongo/models/vote.model.js';
import { ensureTestNeighbourhood } from './helpers';

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
      .send({ email: EMAIL, password: 'password12345', displayName: 'Poll Tester', neighbourhoodId: await ensureTestNeighbourhood() });
    accessToken = (signup.body as { accessToken: string }).accessToken;
    userId = (signup.body as { user: { id: string } }).user.id;

    const plugins = await request(app)
      .get('/plugins')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(plugins.status).toBe(200);
    expect(plugins.body.polls.length).toBeGreaterThanOrEqual(2);

    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const created = await request(app)
      .post('/polls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        neighbourhoodId: NH_ID,
        title: 'Test plugin',
        options: ['A', 'B', 'C'],
        pluginId: 'min-three-options',
        closesAt: future,
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
        closesAt: future,
      });
    expect(fail.status).toBe(422);
  });

  it('rejects a poll without a future end date', async () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    const noDate = await request(app)
      .post('/polls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ neighbourhoodId: NH_ID, title: 'No date', options: ['A', 'B'] });
    expect(noDate.status).toBe(400);

    const pastDate = await request(app)
      .post('/polls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ neighbourhoodId: NH_ID, title: 'Past', options: ['A', 'B'], closesAt: past });
    expect(pastDate.status).toBe(400);
  });

  it('allows changing the vote and reports myChoice + percentages', async () => {
    const first = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ choiceIndex: 0 });
    expect(first.status).toBe(200);

    let poll = await request(app)
      .get(`/polls/${pollId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect((poll.body as { myChoice: number }).myChoice).toBe(0);

    // changement de vote (pas de doublon, pas d'erreur)
    const changed = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ choiceIndex: 2 });
    expect(changed.status).toBe(200);

    poll = await request(app).get(`/polls/${pollId}`).set('Authorization', `Bearer ${accessToken}`);
    const body = poll.body as { myChoice: number; totalVotes: number; percentages: number[] };
    expect(body.myChoice).toBe(2);
    expect(body.totalVotes).toBe(1); // un seul bulletin, déplacé
    expect(body.percentages[2]).toBe(100);
    expect(body.percentages[0]).toBe(0);
  });
});
