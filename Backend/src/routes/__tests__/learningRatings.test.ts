import 'express-async-errors';
import express, { ErrorRequestHandler } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser, createCourse } from '../../test/factories';
import { createLearningRatingsRouter } from '../learningRatings';
import { LearningRatingTarget, withCourseRatings, withTrainingRatings } from '../../services/learningRatingService';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/courses', createLearningRatingsRouter('course'));
  app.use('/live-trainings', createLearningRatingsRouter('live-training'));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Server error' });
  };
  app.use(errors);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

function tokenFor(user: Awaited<ReturnType<typeof createUser>>) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);
}

async function request(path: string, options: { token?: string; body?: unknown } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.body === undefined ? 'GET' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: await response.json() };
}

describe.each<[LearningRatingTarget, string]>([
  ['course', 'courses'], ['live-training', 'live-trainings'],
])('%s ratings HTTP and database contract', (target, route) => {
  let targetId: string;
  let learner: Awaited<ReturnType<typeof createUser>>;
  let token: string;
  let path: string;

  async function enroll(userId: string) {
    if (target === 'course') {
      await prisma.courseEnrollment.create({ data: { userId, courseId: targetId } });
    } else {
      await prisma.liveTrainingEnrollment.create({ data: { userId, liveTrainingId: targetId, status: 'ACTIVE' } });
    }
  }

  beforeEach(async () => {
    learner = await createUser();
    token = tokenFor(learner);
    const record = target === 'course'
      ? await createCourse({})
      : await prisma.liveTraining.create({ data: {
        title: 'Rating test training', description: 'Disposable test training', category: 'Test',
        scheduledAt: new Date('2030-01-01T12:00:00Z'), price: 70000, maxCapacity: 100, published: true,
      } });
    targetId = record.id;
    path = `/${route}/${targetId}/ratings`;
    await enroll(learner.id);
  });

  it.each([0, 6, -1, 3.5, '5', null])('rejects invalid rating %p on the server', async (rating) => {
    const response = await request(path, { token, body: { rating } });
    expect(response.status).toBe(400);
    expect((await request(path)).body.data.reviewCount).toBe(0);
  });

  it('requires authentication and rejects stale/invalid tokens', async () => {
    expect((await request(path, { body: { rating: 5 } })).status).toBe(401);
    expect((await request(path, { token: 'invalid-token', body: { rating: 5 } })).status).toBe(401);
  });

  it('requires actual enrollment, including for administrators', async () => {
    const stranger = await createUser({ adminRole: 'SUPER_ADMIN' });
    expect((await request(path, { token: tokenFor(stranger), body: { rating: 5 } })).status).toBe(403);
    expect((await request(path, { token: tokenFor(stranger) })).body.data.canReview).toBe(false);
  });

  it('rejects banned users even when their enrollment and token remain valid', async () => {
    await prisma.user.update({ where: { id: learner.id }, data: { isBanned: true } });
    expect((await request(path, { token, body: { rating: 4 } })).status).toBe(403);
  });

  it('rejects nonexistent targets without creating reviews', async () => {
    expect((await request(`/${route}/missing-target/ratings`, { token, body: { rating: 4 } })).status).toBe(404);
    expect((await request(`/${route}/missing-target/ratings`)).status).toBe(404);
  });

  it('creates and edits the same review, including clearing the optional comment', async () => {
    const first = await request(path, { token, body: { rating: 4, comment: '  Very helpful  ' } });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ averageRating: 4, reviewCount: 1, canReview: true });
    expect(first.body.data.myReview).toMatchObject({ userId: learner.id, rating: 4, comment: 'Very helpful' });
    const edited = await request(path, { token, body: { rating: 5, comment: '' } });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ averageRating: 5, reviewCount: 1 });
    expect(edited.body.data.myReview).toMatchObject({ id: first.body.data.myReview.id, rating: 5, comment: null });
    expect(edited.body.data.reviews).toHaveLength(1);
  });

  it('calculates averages/counts on the server and ignores spoofed identity or aggregates', async () => {
    const second = await createUser();
    await enroll(second.id);
    await request(path, { token, body: { rating: 2, userId: second.id, averageRating: 5, reviewCount: 999 } });
    const response = await request(path, { token: tokenFor(second), body: { rating: 5 } });
    expect(response.body.data).toMatchObject({ averageRating: 3.5, reviewCount: 2 });
    const publicResult = await request(path);
    expect(publicResult.body.data).toMatchObject({ averageRating: 3.5, reviewCount: 2, canReview: false, myReview: null });
    expect(publicResult.body.data.reviews.map((review: { userId: string }) => review.userId).sort()).toEqual([learner.id, second.id].sort());
    const summary = target === 'course'
      ? await withCourseRatings([{ id: targetId }, { id: 'no-ratings' }])
      : await withTrainingRatings([{ id: targetId }, { id: 'no-ratings' }]);
    expect(summary).toEqual([
      { id: targetId, averageRating: 3.5, reviewCount: 2 },
      { id: 'no-ratings', averageRating: null, reviewCount: 0 },
    ]);
  });

  it('keeps concurrent submissions to one review per learner/target', async () => {
    const responses = await Promise.all([2, 4, 5].map((rating) => request(path, { token, body: { rating } })));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect((await request(path)).body.data.reviewCount).toBe(1);
    const duplicate = target === 'course'
      ? prisma.courseRating.create({ data: { courseId: targetId, userId: learner.id, rating: 5 } })
      : prisma.liveTrainingRating.create({ data: { liveTrainingId: targetId, userId: learner.id, rating: 5 } });
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
  });

  it('also enforces star bounds at the database boundary', async () => {
    const invalid = target === 'course'
      ? prisma.courseRating.create({ data: { courseId: targetId, userId: learner.id, rating: 6 } })
      : prisma.liveTrainingRating.create({ data: { liveTrainingId: targetId, userId: learner.id, rating: 6 } });
    await expect(invalid).rejects.toThrow();
    expect((await request(path)).body.data.reviewCount).toBe(0);
  });

  if (target === 'live-training') {
    it('rejects cancelled enrollment and permits completed enrollment', async () => {
      await prisma.liveTrainingEnrollment.update({ where: { userId_liveTrainingId: { userId: learner.id, liveTrainingId: targetId } }, data: { status: 'CANCELLED' } });
      expect((await request(path, { token, body: { rating: 4 } })).status).toBe(403);
      await prisma.liveTrainingEnrollment.update({ where: { userId_liveTrainingId: { userId: learner.id, liveTrainingId: targetId } }, data: { status: 'COMPLETED' } });
      expect((await request(path, { token, body: { rating: 4 } })).status).toBe(200);
    });

    it('does not reveal ratings for unpublished trainings', async () => {
      await prisma.liveTraining.update({ where: { id: targetId }, data: { published: false } });
      expect((await request(path)).status).toBe(404);
      expect((await request(path, { token, body: { rating: 4 } })).status).toBe(404);
    });
  }
});
