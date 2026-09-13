import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import { execFileSync } from 'child_process';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import authRouter from '../auth';
import adminCompaniesRouter from '../adminCompanies';
import adminVerificationsRouter from '../adminVerifications';
import { errorHandler } from '../../middleware/errorHandler';
import { uploadPrivateBlob, getSignedBlobUrl, deletePrivateBlob } from '../../services/privateBlobStorage';
import { isPrivateVerificationDocRef } from '../../services/verificationDocDelivery';
import { deleteBunnyStorageUrlIfManaged } from '../../services/bunnyStorage';

// Business KYC upload conditionally runs AI parsing (businessKycService) —
// GEMINI_API_KEY is set to a dummy value by test/setupEnv.ts so
// isBusinessKycParsingConfigured() would otherwise report true and attempt
// a real network call. Mocked off entirely here since these tests are about
// storage destination, not the auto-approval heuristic.
jest.mock('../../services/businessKycService', () => ({
  isBusinessKycParsingConfigured: jest.fn().mockReturnValue(false),
  parseBusinessDocument: jest.fn(),
  shouldAutoApprove: jest.fn().mockReturnValue(false),
}));
jest.mock('../../services/auditLogService', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));
// Real module constructs a BlobServiceClient at import time — mocked so
// importing verificationDocDelivery.ts (via auth.ts) never attempts a real
// Azure connection, same reasoning as iako.test.ts's identical mock.
jest.mock('../../services/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn().mockResolvedValue(undefined),
  getSignedBlobUrl: jest.fn().mockImplementation(async (blobName: string, expiryMinutes = 15) => `https://test-blob.example.test/${blobName}?sig=test&exp=${expiryMinutes}`),
  deletePrivateBlob: jest.fn().mockResolvedValue(undefined),
  privateBlobExists: jest.fn().mockResolvedValue(true),
  assertPrivateBlobContainer: jest.fn().mockResolvedValue(undefined),
  privateContainerReady: Promise.resolve(),
}));
jest.mock('../../services/bunnyStorage', () => ({
  uploadToBunnyStorage: jest.fn(),
  isBunnyStorageConfigured: jest.fn().mockReturnValue(false),
  deleteFromBunnyStorage: jest.fn().mockResolvedValue(undefined),
  deleteBunnyStorageUrlIfManaged: jest.fn().mockResolvedValue(undefined),
  BunnyStorageUploadError: jest.requireActual('../../services/bunnyStorage').BunnyStorageUploadError,
  BunnyStorageNotConfiguredError: jest.requireActual('../../services/bunnyStorage').BunnyStorageNotConfiguredError,
  extractBunnyStorageUrls: jest.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/admin/companies', adminCompaniesRouter);
  app.use('/admin/verifications', adminVerificationsRouter);
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

function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.4.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}

// A real, decodable 1x1 transparent PNG.
const PNG_BYTES = Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));

async function uploadDoc(path: string, user: User, extraFields: Record<string, string> = {}) {
  const form = new FormData();
  form.append('document', new Blob([new Uint8Array(PNG_BYTES)], { type: 'image/png' }), 'doc.png');
  for (const [key, value] of Object.entries(extraFields)) form.append(key, value);
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': `198.18.4.${++requestNumber}` }, body: form });
}

describe('Verification document storage', () => {
  it('1. a new business KYC upload stores a private Azure reference', async () => {
    const user = await createUser();
    const response = await uploadDoc('/auth/me/verification-doc', user);
    expect(response.status).toBe(201);
    const body = await response.json() as { user: { verificationDocUrl: string } };
    expect(isPrivateVerificationDocRef(body.user.verificationDocUrl)).toBe(true);
    expect(uploadPrivateBlob).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^verification-docs/${user.id}/`)), expect.any(Buffer), 'image/png');
  });

  it('2. a new individual ID upload stores a private Azure reference', async () => {
    const user = await createUser();
    // A random 11-digit number, not a hardcoded literal — personalNumber is
    // @unique, and this suite's own prior runs can leave rows behind.
    const personalNumber = String(10_000_000_000 + Math.floor(Math.random() * 89_999_999_999));
    const response = await uploadDoc('/auth/me/individual-verification-doc', user, { personalNumber });
    expect(response.status).toBe(201);
    const body = await response.json() as { user: { verificationDocUrl: string } };
    expect(isPrivateVerificationDocRef(body.user.verificationDocUrl)).toBe(true);
  });

  it('3. a failed Azure upload does not overwrite the existing DB reference', async () => {
    const user = await createUser({ verificationDocUrl: 'cdcblob://verification-docs/existing/keep-me.png', verificationLevel: 'BUSINESS' as const });
    jest.mocked(uploadPrivateBlob).mockRejectedValueOnce(new Error('simulated Azure upload failure'));
    const response = await uploadDoc('/auth/me/verification-doc', user);
    expect(response.status).toBe(500);
    const stillThere = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stillThere.verificationDocUrl).toBe('cdcblob://verification-docs/existing/keep-me.png');
  });

  it('4. replacing a document updates the DB only after the new upload succeeds', async () => {
    const user = await createUser();
    const first = await uploadDoc('/auth/me/verification-doc', user);
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { user: { verificationDocUrl: string } };

    jest.mocked(uploadPrivateBlob).mockRejectedValueOnce(new Error('simulated failure on replacement'));
    const failedReplace = await uploadDoc('/auth/me/verification-doc', user);
    expect(failedReplace.status).toBe(500);
    const afterFailedReplace = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(afterFailedReplace.verificationDocUrl).toBe(firstBody.user.verificationDocUrl);

    const secondReplace = await uploadDoc('/auth/me/verification-doc', user);
    expect(secondReplace.status).toBe(201);
    const secondBody = await secondReplace.json() as { user: { verificationDocUrl: string } };
    expect(secondBody.user.verificationDocUrl).not.toBe(firstBody.user.verificationDocUrl);
  });

  it('5. old file cleanup runs only after a successful replacement, targeting the correct provider', async () => {
    const user = await createUser({ verificationDocUrl: 'https://cdn.example.test/kyc/legacy-doc.pdf', verificationLevel: 'BUSINESS' as const });

    jest.mocked(uploadPrivateBlob).mockRejectedValueOnce(new Error('simulated failure'));
    const failed = await uploadDoc('/auth/me/verification-doc', user);
    expect(failed.status).toBe(500);
    expect(deleteBunnyStorageUrlIfManaged).not.toHaveBeenCalled();

    const success = await uploadDoc('/auth/me/verification-doc', user);
    expect(success.status).toBe(201);
    expect(deleteBunnyStorageUrlIfManaged).toHaveBeenCalledWith('https://cdn.example.test/kyc/legacy-doc.pdf');
    // The replaced doc was a legacy Bunny URL, not one of ours — deletePrivateBlob
    // must not fire for a URL that doesn't match our own managed shape.
    expect(deletePrivateBlob).not.toHaveBeenCalled();
  });

  it('6. an authorized admin can resolve a private Azure verification document to a short-lived URL', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const target = await createUser({ verificationDocUrl: 'cdcblob://verification-docs/user-x/550e8400-e29b-41d4-a716-446655440000.png', verificationLevel: 'BUSINESS' as const });
    const response = await request(`/admin/companies/${target.id}/document`, admin);
    expect(response.status).toBe(200);
    const { url } = await data<{ url: string }>(response);
    expect(url).toContain('verification-docs/user-x/550e8400-e29b-41d4-a716-446655440000.png');
    expect(getSignedBlobUrl).toHaveBeenCalledWith('verification-docs/user-x/550e8400-e29b-41d4-a716-446655440000.png', 15);
  });

  it('7. a non-admin cannot resolve another user\'s verification document via the admin endpoints', async () => {
    const learner = await createUser();
    const target = await createUser({ verificationDocUrl: 'cdcblob://verification-docs/user-y/550e8400-e29b-41d4-a716-446655440000.png' });
    const companiesResponse = await request(`/admin/companies/${target.id}/document`, learner);
    expect(companiesResponse.status).toBe(403);
    const verificationsResponse = await request(`/admin/verifications/${target.id}/document`, learner);
    expect(verificationsResponse.status).toBe(403);
    expect(getSignedBlobUrl).not.toHaveBeenCalled();
  });

  it('8. a legacy Bunny verification document URL remains readable through the compatibility resolve path', async () => {
    const user = await createUser({ verificationDocUrl: 'https://cdn.example.test/kyc/legacy-doc.pdf' });
    const response = await request('/auth/me/verification-doc', user);
    expect(response.status).toBe(200);
    const { url } = await data<{ url: string }>(response);
    expect(url).toBe('https://cdn.example.test/kyc/legacy-doc.pdf');
    expect(getSignedBlobUrl).not.toHaveBeenCalled();
  });

  it('9. the dry-run legacy-document detector script performs zero mutations', async () => {
    const user = await createUser({ verificationDocUrl: 'https://cdn.example.test/kyc/legacy-for-detector.pdf' });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const backendRoot = path.resolve(__dirname, '../../..');
    const output = execFileSync('npx', ['ts-node', 'scripts/verification-doc-storage-audit.ts'], {
      cwd: backendRoot,
      env: process.env,
      encoding: 'utf-8',
      timeout: 60000,
      shell: true,
    });
    expect(output).toContain('DRY RUN, no changes made');
    expect(output).toMatch(/Legacy Bunny verification docs: \d+/);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toEqual(before);
  }, 70000);

  it('10. no permanent Azure public URL is ever returned to the client for a new upload', async () => {
    const user = await createUser();
    const response = await uploadDoc('/auth/me/verification-doc', user);
    const body = await response.json() as { user: { verificationDocUrl: string } };
    expect(body.user.verificationDocUrl.startsWith('cdcblob://')).toBe(true);
    expect(body.user.verificationDocUrl).not.toMatch(/^https?:\/\//);
  });
});
