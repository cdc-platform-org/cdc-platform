import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import educatorHubRoutes from '../educatorHub';
import { errorHandler } from '../../middleware/errorHandler';
import { issueSessionId } from '../../services/educatorVipService';
import { uploadPrivateBlob, getSignedBlobUrl } from '../../services/privateBlobStorage';

// Fix D1: CertificateBuilder called POST /api/certificates/generate, which
// did not exist anywhere in the backend — Generate silently failed. This
// suite covers the real replacement route, /api/educator-hub/generate-certificates.
//
// The real privateBlobStorage module constructs a BlobServiceClient at
// import time (Azure Managed Identity) — mocked here so importing
// educatorHub.ts never attempts a real Azure connection in tests, same
// pattern as verificationDocs.test.ts's identical mock.
jest.mock('../../services/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn().mockResolvedValue(undefined),
  getSignedBlobUrl: jest.fn().mockImplementation(async (blobName: string, expiryMinutes = 15) => `https://test-blob.example.test/${blobName}?sig=test&exp=${expiryMinutes}`),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/educator-hub', educatorHubRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => jest.clearAllMocks());
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

// D7: requireCurrentEducatorSession now actually enforces the token's
// `sid` claim against User.currentSessionId, so a test token needs a real,
// current sid — issueSessionId is what a real login mints one with (see
// routes/auth.ts's signToken), so calling it here before signing simulates
// "this user just logged in" rather than weakening the middleware to keep
// old sid-less tokens passing.
async function request(path: string, user: User | undefined, method: string, body?: unknown) {
  const sid = user && (await issueSessionId(user.id));
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email, sid }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `198.18.8.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('POST /educator-hub/generate-certificates', () => {
  it('generates one private, signed certificate URL per student name', async () => {
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });

    const res = await request('/api/educator-hub/generate-certificates', teacher, 'POST', {
      names: ['Nino Beridze', 'Giorgi Maisuradze'],
      certificateType: 'WEEKLY_STAR',
      language: 'en',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { certificates: string[] } };
    expect(body.data.certificates).toHaveLength(2);
    for (const url of body.data.certificates) {
      expect(url).toMatch(/^https:\/\/test-blob\.example\.test\//);
    }

    expect(uploadPrivateBlob).toHaveBeenCalledTimes(2);
    for (const call of jest.mocked(uploadPrivateBlob).mock.calls) {
      const [blobName, buffer, mimetype] = call;
      expect(blobName).toMatch(new RegExp(`^teacher-certificates/${teacher.id}/[0-9a-f-]+\\.pdf$`));
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(mimetype).toBe('application/pdf');
    }
  });

  it('rejects CUSTOM type with no nomination text (400, no blob uploaded)', async () => {
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const res = await request('/api/educator-hub/generate-certificates', teacher, 'POST', {
      names: ['Nino Beridze'],
      certificateType: 'CUSTOM',
      language: 'en',
    });
    expect(res.status).toBe(400);
    expect(uploadPrivateBlob).not.toHaveBeenCalled();
  });

  it('accepts CUSTOM type when a nomination is supplied', async () => {
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const res = await request('/api/educator-hub/generate-certificates', teacher, 'POST', {
      names: ['Nino Beridze'],
      certificateType: 'CUSTOM',
      customNomination: 'Best class project',
      language: 'ka',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { certificates: string[] } };
    expect(body.data.certificates).toHaveLength(1);
  });

  it('rejects an empty names array (400)', async () => {
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const res = await request('/api/educator-hub/generate-certificates', teacher, 'POST', {
      names: [],
      certificateType: 'WEEKLY_STAR',
      language: 'en',
    });
    expect(res.status).toBe(400);
    expect(uploadPrivateBlob).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await request('/api/educator-hub/generate-certificates', undefined, 'POST', {
      names: ['Nino Beridze'],
      certificateType: 'WEEKLY_STAR',
      language: 'en',
    });
    expect(res.status).toBe(401);
    expect(uploadPrivateBlob).not.toHaveBeenCalled();
  });

  it('rejects a non-VIP, non-trial educator (403 VIP_REQUIRED)', async () => {
    const teacher = await createUser({ educatorVipActive: false, role: 'Mentor' });
    const res = await request('/api/educator-hub/generate-certificates', teacher, 'POST', {
      names: ['Nino Beridze'],
      certificateType: 'WEEKLY_STAR',
      language: 'en',
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VIP_REQUIRED');
    expect(uploadPrivateBlob).not.toHaveBeenCalled();
  });
});
