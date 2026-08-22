import { prisma } from '../lib/prisma';

// ============================================================
// IP/device history + anomaly detection for financial actions — the input
// bogPayoutService.evaluateRiskTier uses to decide whether a payout is
// being requested from somewhere the account has actually been seen
// before. Two pieces:
//
//   1. recordLoginEvent — called from every successful authentication
//      point (routes/auth.ts's five signToken call sites: register,
//      login, google, github/callback, facebook/callback) to build the
//      history a later financial action gets compared against.
//   2. detectSessionAnomaly — called from routes/wallet.ts at payout-
//      request creation time, comparing the request's IP against that
//      history.
//
// "Device" here is the raw User-Agent header, not a true fingerprint
// (canvas/WebGL/audio entropy, etc.) — that needs a client-side library
// (e.g. FingerprintJS) collecting signal the frontend doesn't send today.
// User-Agent is a real, honest, zero-frontend-work signal; it's just a
// much weaker one (two different people on the same OS/browser/version
// look identical, and a UA string is trivial for anyone motivated to
// spoof). It's used here as a secondary signal alongside IP/subnet, not
// as the primary anomaly determinant — flagged clearly as a known
// limitation rather than presented as a real device fingerprint.
//
// Geolocation (the third signal PSD2-adjacent risk engines typically use)
// is NOT implemented — this codebase has no MaxMind/ipapi/similar
// dependency or credential configured anywhere, and fabricating a "works
// today" geo check would be worse than not having one. See
// resolveGeoLocation's own comment.
// ============================================================

// How far back "recent login history" looks when deciding whether an IP
// is recognized — matches the "X hours/days" the request asked for as a
// configurable window. 30 days balances two failure modes: too short and
// a real user's own infrequent-but-legitimate login pattern gets flagged
// every time; too long and a genuinely stale, long-abandoned IP still
// "vouches" for a request that should be scrutinized.
export const ANOMALY_LOOKBACK_HOURS = 24 * 30;

export async function recordLoginEvent(userId: string, ip: string, userAgent?: string | null): Promise<void> {
  await prisma.loginEvent.create({ data: { userId, ip, userAgent: userAgent ?? null } });
}

// IPv4: compares the /24 (first three octets) — the common "same ISP
// session / same office network" granularity. IPv6: compares the first
// four hextets (~/64), the typical single-customer allocation boundary.
// Anything that parses as neither falls back to exact-string comparison
// rather than guessing.
export function ipSubnet(ip: string): string {
  if (ip.includes('.')) {
    const octets = ip.split('.');
    if (octets.length === 4) return octets.slice(0, 3).join('.');
  }
  if (ip.includes(':')) {
    const hextets = ip.split(':');
    if (hextets.length >= 4) return hextets.slice(0, 4).join(':');
  }
  return ip;
}

export interface SessionAnomalyInput {
  userId: string;
  currentIp: string;
  currentUserAgent?: string | null;
  lookbackHours?: number;
}

export interface SessionAnomalyCheckResult {
  anomalous: boolean;
  // Populated only when anomalous — folded verbatim into
  // evaluateRiskTier's reasons[], see that function's own doc for the
  // exact wording contract.
  detail: string | null;
}

// Fail-safe by construction: an account with NO login history in the
// lookback window (predates this feature, every prior login happened
// before it shipped, or the window is simply short) cannot be vouched
// for — treated as anomalous, same "when in doubt, require a human"
// posture every other evaluateRiskTier rule already takes.
export async function detectSessionAnomaly(input: SessionAnomalyInput): Promise<SessionAnomalyCheckResult> {
  const lookbackHours = input.lookbackHours ?? ANOMALY_LOOKBACK_HOURS;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const recentLogins = await prisma.loginEvent.findMany({
    where: { userId: input.userId, createdAt: { gte: since } },
    select: { ip: true, userAgent: true },
  });

  if (recentLogins.length === 0) {
    return { anomalous: true, detail: 'No prior login history found for this account in the lookback window.' };
  }

  const currentSubnet = ipSubnet(input.currentIp);
  const ipRecognized = recentLogins.some((login) => login.ip === input.currentIp || ipSubnet(login.ip) === currentSubnet);
  if (!ipRecognized) {
    return { anomalous: true, detail: `IP ${input.currentIp} does not match any recent login (or its subnet).` };
  }

  // Secondary signal, only checked once the IP itself is already
  // recognized — a brand-new device on a KNOWN network (e.g. a new phone
  // on the user's own home wifi) is a much weaker anomaly signal than a
  // brand-new IP outright, so this alone still flags, but with its own
  // distinguishable detail message.
  if (input.currentUserAgent) {
    const deviceRecognized = recentLogins.some((login) => login.userAgent === input.currentUserAgent);
    if (!deviceRecognized) {
      return { anomalous: true, detail: 'Device (User-Agent) does not match any recent login from this account.' };
    }
  }

  return { anomalous: false, detail: null };
}

// NOT IMPLEMENTED — see the module header comment. Kept as a named,
// awaited-shaped stub (rather than omitted entirely) so a real provider
// can be dropped in behind this exact signature later without touching
// any call site, same "build the seam now, wire the real thing in later"
// posture as bogPayoutService.callBogMassPayoutApi.
export async function resolveGeoLocation(_ip: string): Promise<{ country: string } | null> {
  return null;
}
