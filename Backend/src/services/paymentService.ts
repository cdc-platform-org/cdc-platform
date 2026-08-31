import crypto from 'crypto';

export function validateWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET || '';
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return hash === signature;
}
