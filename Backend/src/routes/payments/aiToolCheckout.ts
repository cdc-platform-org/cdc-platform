import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { authenticate, requireApproved } from '../../middleware/auth';
import { AI_TOOL_MONTHLY_PRICE_MINOR, isAiSubscriptionTool } from '../../config/aiToolSubscriptions';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { hasActiveCollegeAiAccess } from '../../services/learning/collegeAiAccessService';
import { checkoutRateLimit, CALLBACK_URL, checkoutLang, resultRedirects, findReusablePendingOrder, createBogOrderOrRespond } from './shared';

const router = Router();
router.post('/checkout/ai-tool/:key', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const key = req.params.key;
  if (!isAiSubscriptionTool(key)) return res.status(404).json({ message: 'Unknown AI tool.' });
  const catalog = await prisma.siteContent.findUnique({ where: { page: 'tool-catalog' }, select: { content: true } });
  const slug = key === 'chatbot-builder' || key === 'ai-agents' ? 'enterprise-ai' : key;
  const tools = (catalog?.content as { tools?: { slug?: string; status?: string }[] } | null)?.tools;
  const entry = Array.isArray(tools) ? tools.find(tool => tool.slug === slug) : undefined;
  const admin = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  if (entry?.status === 'DISABLED' || entry?.status === 'COMING_SOON' || (entry?.status === 'ADMIN_ONLY' && !admin)) return res.status(403).json({ message: 'This tool is not available for purchase.' });
  if (await hasActiveCollegeAiAccess(req.user!.id)) return res.json({ included: true, enrolled: true, redirectUrl: null });
  const amount = AI_TOOL_MONTHLY_PRICE_MINOR; // Never accepts a client-supplied price or period.
  const reusable = await findReusablePendingOrder(req.user!.id, 'AI_TOOL_SUBSCRIPTION', key, amount, null);
  if (reusable) return res.json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });
  const payment = await prisma.bogPayment.create({ data: { bogOrderId: `pending-${crypto.randomUUID()}`, userId: req.user!.id, purpose: 'AI_TOOL_SUBSCRIPTION', paymentModel: paymentModelForPurpose('AI_TOOL_SUBSCRIPTION'), referenceId: key, amount, currency: 'GEL', status: 'PENDING' } });
  const { successRedirectUrl, failRedirectUrl } = resultRedirects(payment.id);
  const order = await createBogOrderOrRespond(res, { externalOrderId: payment.id, amount, currency: 'GEL', basketItemName: `CDC ${key} — 30 days`, callbackUrl: CALLBACK_URL, successRedirectUrl, failRedirectUrl, lang: checkoutLang(req) });
  if (!order) return;
  await prisma.bogPayment.update({ where: { id: payment.id }, data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl } });
  res.status(201).json({ paymentId: payment.id, redirectUrl: order.redirectUrl });
});
export default router;
