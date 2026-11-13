/**
 * Social sign-in: Google (ID-token POST), GitHub and Facebook (redirect
 * flows with a signed state parameter).
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { prisma } from '../../lib/prisma';
import { googleAuthSchema } from '../../schemas/authSchemas';
import {
  GOOGLE_CLIENT_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET,
  FACEBOOK_CALLBACK_URL,
} from '../../utils/env';
import {
  googleClient,
  FRONTEND_URL,
  authRateLimit,
  signOauthState,
  verifyOauthState,
  maybePromoteSuperAdmin,
  signToken,
  trackLoginEvent,
  toUserResponse,
} from './shared';

const router = Router();

// "1-Click" Google Sign-In: the frontend loads Google's GSI script, gets an
// ID token credential from the button/One Tap prompt, and POSTs it here —
// this never sees the user's Google password, only a signed token we verify
// against Google's public keys (google-auth-library handles key rotation).
router.post('/google', authRateLimit, async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    // Captured (not just console.error'd) because this is the "someone
    // wiped/never set the env var" case — the kind of failure that's easy
    // to miss in raw logs but should page/alert like any other outage,
    // since it silently breaks Google Sign-In for every single visitor.
    console.error('[auth] Google Sign-In attempted but GOOGLE_CLIENT_ID is not configured.');
    Sentry.captureMessage('Google Sign-In attempted with no GOOGLE_CLIENT_ID configured', {
      level: 'error',
      tags: { route: 'auth/google', cause: 'not_configured' },
    });
    return res.status(501).json({ message: 'Google Sign-In is not configured on this server.' });
  }
  const result = googleAuthSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: result.data.idToken, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    // Logged server-side AND to Sentry — the client-facing message stays
    // generic so it can't be used to probe why a specific token was
    // rejected, but an operator debugging a wave of failed sign-ins (e.g. a
    // misconfigured GOOGLE_CLIENT_ID — the `aud` mismatch shows up here as
    // "Wrong recipient, payload audience != requiredAudience" — vs a
    // genuinely expired/replayed token) needs the real cause, not just "it
    // failed." Tagged distinctly from the not-configured branch above so
    // Sentry can group "config problem" separately from "verification
    // problem" without reading the message text.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[auth] Google ID token verification failed:', message);
    Sentry.captureException(err, {
      tags: { route: 'auth/google', cause: 'token_verification_failed' },
      extra: { verifyIdTokenError: message },
    });
    return res.status(401).json({ message: 'Invalid or expired Google credential.' });
  }
  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ message: 'Google account has no verified email.' });
  }

  const normalizedEmail = payload.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: normalizedEmail }] },
  });

  if (user) {
    if (user.isBanned) {
      return res.status(403).json({ message: 'This account has been banned.' });
    }
    if (user.deletionRequestedAt) {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }
    if (!user.googleId) {
      // Existing email/password account signing in with Google for the first
      // time — link it, rather than creating a second account for the same email.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
    }
  } else {
    const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
    try {
      user = await prisma.user.create({
        data: {
          name: payload.name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          password: randomPassword, // unusable for password login — this account signs in via Google only
          role: result.data.role ?? 'Student',
          // Same reasoning as POST /register — googleAuthSchema only ever
          // grants Student or Client, both self-serve roles that don't need
          // manual admin vetting.
          status: 'APPROVED',
          googleId: payload.sub,
          emailVerifiedAt: new Date(), // Google already verified this email
        },
      });
    } catch (err: any) {
      // The One Tap prompt / button can fire twice in quick succession (e.g.
      // a re-render right as the user clicks), sending two concurrent
      // requests for the same brand-new email — the findFirst above ran
      // before either had committed, so both took this branch. Whichever
      // commits second hits the unique email/googleId constraint here
      // instead of crashing into a raw 500.
      if (err.code === 'P2002') {
        console.error('[auth] Google sign-up race on', normalizedEmail, '— retrying as existing user.');
        user = await prisma.user.findFirst({
          where: { OR: [{ googleId: payload.sub }, { email: normalizedEmail }] },
        });
        if (!user) throw err;
      } else {
        throw err;
      }
    }
  }

  user = await maybePromoteSuperAdmin(user);
  const token = await signToken(user);
  trackLoginEvent(user.id, req);
  res.json({ token, user: toUserResponse(user) });
});

// ============================================================
// GITHUB / FACEBOOK SIGN-IN — unlike Google above (client-side ID token,
// verified server-side with no redirect), GitHub and Facebook only support
// the traditional server-side flow: the browser is redirected to the
// provider, the provider redirects back here with a `code`, this backend
// exchanges that code for an access token and fetches the profile itself.
// The frontend buttons are therefore plain links to GET /github or
// /facebook, not a JS SDK popup — see AuthModal.tsx.
// ============================================================

router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(501).json({ message: 'GitHub Sign-In is not configured on this server.' });
  }
  const role = req.query.role === 'Client' ? 'Client' : req.query.role === 'Student' ? 'Student' : undefined;
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', GITHUB_CALLBACK_URL);
  authorizeUrl.searchParams.set('scope', 'read:user user:email');
  authorizeUrl.searchParams.set('state', signOauthState(role));
  res.redirect(authorizeUrl.toString());
});

router.get('/github/callback', async (req: Request, res: Response) => {
  const failRedirect = `${FRONTEND_URL}/auth/login?error=github`;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) return res.redirect(failRedirect);

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') return res.redirect(failRedirect);

  let role: 'Student' | 'Client' | undefined;
  try {
    role = verifyOauthState(state).role;
  } catch {
    return res.redirect(failRedirect);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error('[auth] GitHub token exchange failed:', tokenData.error ?? tokenData);
      return res.redirect(failRedirect);
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
    });
    const profile = (await profileRes.json()) as {
      id: number; login: string; name: string | null; email: string | null; avatar_url: string | null;
    };

    // GitHub's /user endpoint omits `email` when the user has it set to
    // private (common) — the verified primary address needs a second call.
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
      });
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email ?? null;
    }
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=github_no_email`);
    }

    const githubId = String(profile.id);
    const normalizedEmail = email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ githubId }, { email: normalizedEmail }] } });

    if (user) {
      if (user.isBanned) return res.redirect(`${FRONTEND_URL}/auth/login?error=banned`);
      if (user.deletionRequestedAt) return res.redirect(`${FRONTEND_URL}/auth/login?error=deactivated`);
      if (!user.githubId) {
        // Existing email/password (or Google) account signing in with
        // GitHub for the first time — link it rather than creating a
        // second account for the same email.
        user = await prisma.user.update({
          where: { id: user.id },
          data: { githubId, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
        });
      }
    } else {
      const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
      try {
        user = await prisma.user.create({
          data: {
            name: profile.name || profile.login || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password: randomPassword, // unusable — this account signs in via GitHub only
            role: role ?? 'Student',
            status: 'APPROVED',
            githubId,
            avatarUrl: profile.avatar_url || null,
            emailVerifiedAt: new Date(),
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          user = await prisma.user.findFirst({ where: { OR: [{ githubId }, { email: normalizedEmail }] } });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    user = await maybePromoteSuperAdmin(user);
    const token = await signToken(user);
    trackLoginEvent(user.id, req);
    res.redirect(`${FRONTEND_URL}/auth/oauth-callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[auth] GitHub OAuth callback failed:', err instanceof Error ? err.message : err);
    res.redirect(failRedirect);
  }
});

router.get('/facebook', (req: Request, res: Response) => {
  if (!FACEBOOK_CLIENT_ID) {
    return res.status(501).json({ message: 'Facebook Sign-In is not configured on this server.' });
  }
  const role = req.query.role === 'Client' ? 'Client' : req.query.role === 'Student' ? 'Student' : undefined;
  const authorizeUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  authorizeUrl.searchParams.set('client_id', FACEBOOK_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', FACEBOOK_CALLBACK_URL);
  authorizeUrl.searchParams.set('scope', 'email,public_profile');
  authorizeUrl.searchParams.set('state', signOauthState(role));
  res.redirect(authorizeUrl.toString());
});

router.get('/facebook/callback', async (req: Request, res: Response) => {
  const failRedirect = `${FRONTEND_URL}/auth/login?error=facebook`;
  if (!FACEBOOK_CLIENT_ID || !FACEBOOK_CLIENT_SECRET) return res.redirect(failRedirect);

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') return res.redirect(failRedirect);

  let role: 'Student' | 'Client' | undefined;
  try {
    role = verifyOauthState(state).role;
  } catch {
    return res.redirect(failRedirect);
  }

  try {
    const redirectUri = FACEBOOK_CALLBACK_URL;
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_CLIENT_ID);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_CLIENT_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: unknown };
    if (!tokenData.access_token) {
      console.error('[auth] Facebook token exchange failed:', tokenData.error ?? tokenData);
      return res.redirect(failRedirect);
    }

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email,picture');
    profileUrl.searchParams.set('access_token', tokenData.access_token);
    const profileRes = await fetch(profileUrl.toString());
    const profile = (await profileRes.json()) as {
      id: string; name?: string; email?: string; picture?: { data?: { url?: string } };
    };

    if (!profile.email) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=facebook_no_email`);
    }

    const facebookId = String(profile.id);
    const normalizedEmail = profile.email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ facebookId }, { email: normalizedEmail }] } });

    if (user) {
      if (user.isBanned) return res.redirect(`${FRONTEND_URL}/auth/login?error=banned`);
      if (user.deletionRequestedAt) return res.redirect(`${FRONTEND_URL}/auth/login?error=deactivated`);
      if (!user.facebookId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { facebookId, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
        });
      }
    } else {
      const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
      try {
        user = await prisma.user.create({
          data: {
            name: profile.name || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password: randomPassword, // unusable — this account signs in via Facebook only
            role: role ?? 'Student',
            status: 'APPROVED',
            facebookId,
            avatarUrl: profile.picture?.data?.url || null,
            emailVerifiedAt: new Date(),
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          user = await prisma.user.findFirst({ where: { OR: [{ facebookId }, { email: normalizedEmail }] } });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    user = await maybePromoteSuperAdmin(user);
    const token = await signToken(user);
    trackLoginEvent(user.id, req);
    res.redirect(`${FRONTEND_URL}/auth/oauth-callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[auth] Facebook OAuth callback failed:', err instanceof Error ? err.message : err);
    res.redirect(failRedirect);
  }
});

export default router;
