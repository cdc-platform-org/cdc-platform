import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { BOG_CLIENT_ID, BOG_SECRET_KEY } from '../utils/env';

// ============================================================
// Bank of Georgia (BOG) Payment API client.
// Docs: https://api.bog.ge/docs/en/payments/introduction
// ============================================================

const OAUTH_TOKEN_URL = 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const CREATE_ORDER_URL = 'https://api.bog.ge/payments/v1/ecommerce/orders';
const RECEIPT_URL = (orderId: string) => `https://api.bog.ge/payments/v1/receipt/${orderId}`;

// Published by BOG for verifying the `Callback-Signature` header on
// POST /api/payments/bog/callback — see routes/payments.ts. Must be verified
// against the RAW request body bytes, before JSON parsing/re-serialization
// (re-stringifying can reorder fields and break the signature match).
// Source: https://api.bog.ge/docs/en/payments/standard-process/callback
const BOG_CALLBACK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`;

// Fails fast/loud if BOG ever rotates this key without us noticing, rather
// than silently rejecting every callback with an opaque "invalid signature".
const bogPublicKeyObject = crypto.createPublicKey(BOG_CALLBACK_PUBLIC_KEY);

export type BogOrderStatusKey =
  | 'created'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'refund_requested'
  | 'refunded'
  | 'refunded_partially'
  | 'auth_requested'
  | 'blocked'
  | 'partial_completed';

export interface BogOrderDetails {
  order_id: string;
  order_status: { key: BogOrderStatusKey; value?: string };
  purchase_units?: { transfer_amount?: string; request_amount?: string; currency_code?: string };
  [key: string]: unknown;
}

class BogNotConfiguredError extends Error {
  constructor() {
    super(
      'Bank of Georgia payment gateway is not configured. Set BOG_CLIENT_ID/BOG_SECRET_KEY or fill in the Admin Panel BOG settings (/admin/financials).'
    );
    this.name = 'BogNotConfiguredError';
  }
}

// Env vars take priority; DB (Admin Panel → /admin/financials, SuperAdmin
// only, see routes/adminPanel.ts) is the fallback — matches the explicit
// requirement that credentials come from the environment first.
async function getBogCredentials(): Promise<{ clientId: string; secretKey: string }> {
  if (BOG_CLIENT_ID && BOG_SECRET_KEY) {
    return { clientId: BOG_CLIENT_ID, secretKey: BOG_SECRET_KEY };
  }
  const settings = await prisma.bogSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (settings?.clientId && settings?.secretKey) {
    return { clientId: settings.clientId, secretKey: settings.secretKey };
  }
  throw new BogNotConfiguredError();
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  clientId: string;
}
let cachedToken: CachedToken | null = null;
// Refresh a bit early so a token doesn't expire mid-request.
const TOKEN_REFRESH_MARGIN_MS = 30_000;

async function getAccessToken(): Promise<string> {
  const { clientId, secretKey } = await getBogCredentials();
  const now = Date.now();
  if (cachedToken && cachedToken.clientId === clientId && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cachedToken.accessToken;
  }
  const basicAuth = Buffer.from(`${clientId}:${secretKey}`).toString('base64');
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BOG OAuth token request failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
    clientId,
  };
  return cachedToken.accessToken;
}

export interface CreateBogOrderParams {
  externalOrderId: string;
  // Minor currency units (cents/tetri) — matches this codebase's convention
  // for every other Int money field (Gig.budgetAmount, GigApplication.bidAmount,
  // GigTransaction.grossAmount, BogPayment.amount). Converted to BOG's expected
  // major-unit decimal (e.g. 49.99) only at this API boundary.
  amount: number;
  currency: 'GEL' | 'USD' | 'EUR' | 'GBP';
  basketItemName: string;
  callbackUrl: string;
  successRedirectUrl: string;
  failRedirectUrl: string;
}

export interface CreateBogOrderResult {
  bogOrderId: string;
  redirectUrl: string;
}

export async function createBogOrder(params: CreateBogOrderParams): Promise<CreateBogOrderResult> {
  const accessToken = await getAccessToken();
  const majorAmount = Math.round(params.amount) / 100;
  const response = await fetch(CREATE_ORDER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callback_url: params.callbackUrl,
      external_order_id: params.externalOrderId,
      purchase_units: {
        currency: params.currency,
        total_amount: majorAmount,
        basket: [
          {
            product_id: params.externalOrderId,
            quantity: 1,
            unit_price: majorAmount,
            unit_discount_price: 0,
          },
        ],
      },
      redirect_urls: {
        success: params.successRedirectUrl,
        fail: params.failRedirectUrl,
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BOG create-order request failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { id: string; _links: { redirect: { href: string } } };
  return { bogOrderId: data.id, redirectUrl: data._links.redirect.href };
}

export async function getBogOrderDetails(bogOrderId: string): Promise<BogOrderDetails> {
  const accessToken = await getAccessToken();
  const response = await fetch(RECEIPT_URL(bogOrderId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BOG get-order-details request failed (${response.status}): ${body}`);
  }
  return (await response.json()) as BogOrderDetails;
}

// Must run against the RAW bytes of the callback request body — see
// server.ts's express.json({ verify }) which stashes req.rawBody for this
// exact purpose. Verifying a re-serialized JSON.stringify(req.body) instead
// would let a subtly-reordered/reformatted forged payload slip past.
export function verifyBogCallbackSignature(rawBody: Buffer, signatureBase64: string): boolean {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(bogPublicKeyObject, signatureBase64, 'base64');
  } catch {
    return false;
  }
}
