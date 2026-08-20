import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, UserDelegationKey } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { AZURE_STORAGE_ACCOUNT_URL, AZURE_STORAGE_CONTAINER_NAME } from '../utils/env';

// ============================================================
// Shared private Azure Blob client — extracted from routes/upload.ts (the
// lesson-video upload route), which pioneered this codebase's "private
// container + short-lived user-delegation-key-signed SAS URL" pattern.
// Centralized here so a second caller (product file delivery, see
// productFileDelivery.ts) doesn't spin up its own BlobServiceClient/
// delegation-key cache — that would double the "Get User Delegation Key"
// API calls for no benefit, and risks the two caches silently drifting on
// expiry/refresh timing.
//
// No shared key or connection string anywhere in this file — auth is via
// Managed Identity / Azure AD (DefaultAzureCredential), same as upload.ts.
// ============================================================

const SAS_EXPIRY_MINUTES = 15;
const DELEGATION_KEY_VALIDITY_HOURS = 1;
const DELEGATION_KEY_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MARGIN_MS = 5 * 60 * 1000;

const credential = new DefaultAzureCredential();
const blobServiceClient = new BlobServiceClient(AZURE_STORAGE_ACCOUNT_URL, credential);
const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
// No `access` option => private container. No anonymous/public reads; every
// read goes through a short-lived, delegation-key-signed SAS URL.
export const privateContainerReady = containerClient.createIfNotExists();
privateContainerReady.catch(() => {});

let cachedDelegationKey: { key: UserDelegationKey; expiresOn: Date } | null = null;

async function getDelegationKey(): Promise<UserDelegationKey> {
  const now = Date.now();
  if (cachedDelegationKey && cachedDelegationKey.expiresOn.getTime() - now > DELEGATION_KEY_REFRESH_MARGIN_MS) {
    return cachedDelegationKey.key;
  }
  const startsOn = new Date(now - CLOCK_SKEW_MARGIN_MS);
  const expiresOn = new Date(now + DELEGATION_KEY_VALIDITY_HOURS * 60 * 60 * 1000);
  const key = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn);
  cachedDelegationKey = { key, expiresOn };
  return key;
}

export async function uploadPrivateBlob(blobName: string, buffer: Buffer, mimetype: string): Promise<void> {
  await privateContainerReady;
  await containerClient.getBlockBlobClient(blobName).uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });
}

export async function privateBlobExists(blobName: string): Promise<boolean> {
  await privateContainerReady;
  return containerClient.getBlockBlobClient(blobName).exists();
}

export async function getSignedBlobUrl(blobName: string, expiryMinutes: number = SAS_EXPIRY_MINUTES): Promise<string> {
  const delegationKey = await getDelegationKey();
  const now = Date.now();
  const sas = generateBlobSASQueryParameters(
    {
      containerName: AZURE_STORAGE_CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(now - CLOCK_SKEW_MARGIN_MS),
      expiresOn: new Date(now + expiryMinutes * 60 * 1000),
    },
    delegationKey,
    blobServiceClient.accountName
  ).toString();
  return `${containerClient.getBlockBlobClient(blobName).url}?${sas}`;
}
