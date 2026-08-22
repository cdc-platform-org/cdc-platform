import { prisma } from '../../lib/prisma';
import { recordLoginEvent, detectSessionAnomaly, ipSubnet, resolveGeoLocation, ANOMALY_LOOKBACK_HOURS } from '../sessionAnomalyService';
import { createUser } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ipSubnet', () => {
  it('reduces an IPv4 address to its /24', () => {
    expect(ipSubnet('203.0.113.42')).toBe('203.0.113');
    expect(ipSubnet('203.0.113.99')).toBe('203.0.113');
  });

  it('reduces an IPv6 address to its first four hextets', () => {
    expect(ipSubnet('2001:db8:1234:5678:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1234:5678');
  });

  it('falls back to exact string comparison for anything unparseable', () => {
    expect(ipSubnet('unknown')).toBe('unknown');
  });
});

describe('recordLoginEvent + detectSessionAnomaly', () => {
  it('flags an account with no login history at all — fail-safe default', async () => {
    const user = await createUser();
    const result = await detectSessionAnomaly({ userId: user.id, currentIp: '203.0.113.42' });
    expect(result.anomalous).toBe(true);
    expect(result.detail).toContain('No prior login history');
  });

  it('recognizes an exact IP seen in recent login history', async () => {
    const user = await createUser();
    await recordLoginEvent(user.id, '203.0.113.42', 'Mozilla/5.0 TestAgent');

    const result = await detectSessionAnomaly({ userId: user.id, currentIp: '203.0.113.42', currentUserAgent: 'Mozilla/5.0 TestAgent' });
    expect(result.anomalous).toBe(false);
  });

  it('recognizes an IP in the same /24 subnet as a recent login, even if not identical', async () => {
    const user = await createUser();
    await recordLoginEvent(user.id, '203.0.113.10', 'Mozilla/5.0 TestAgent');

    const result = await detectSessionAnomaly({ userId: user.id, currentIp: '203.0.113.250', currentUserAgent: 'Mozilla/5.0 TestAgent' });
    expect(result.anomalous).toBe(false);
  });

  it('flags an IP outside every recent login subnet', async () => {
    const user = await createUser();
    await recordLoginEvent(user.id, '203.0.113.10', 'Mozilla/5.0 TestAgent');

    const result = await detectSessionAnomaly({ userId: user.id, currentIp: '198.51.100.10' });
    expect(result.anomalous).toBe(true);
    expect(result.detail).toContain('does not match any recent login');
  });

  it('flags an unrecognized device (User-Agent) even on a recognized IP', async () => {
    const user = await createUser();
    await recordLoginEvent(user.id, '203.0.113.10', 'Mozilla/5.0 KnownDevice');

    const result = await detectSessionAnomaly({
      userId: user.id,
      currentIp: '203.0.113.10',
      currentUserAgent: 'curl/8.0 SomethingElse',
    });
    expect(result.anomalous).toBe(true);
    expect(result.detail).toContain('Device (User-Agent)');
  });

  it('ignores login history older than the lookback window', async () => {
    const user = await createUser();
    await recordLoginEvent(user.id, '203.0.113.10', 'Mozilla/5.0 TestAgent');
    // Backdate it past the default lookback window directly, since
    // recordLoginEvent always stamps "now".
    await prisma.loginEvent.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - (ANOMALY_LOOKBACK_HOURS + 24) * 60 * 60 * 1000) },
    });

    const result = await detectSessionAnomaly({ userId: user.id, currentIp: '203.0.113.10' });
    expect(result.anomalous).toBe(true); // the only login on record is now too old to count
  });

  it('respects a custom lookback window', async () => {
    const user = await createUser();
    await recordLoginEvent(user.id, '203.0.113.10', 'Mozilla/5.0 TestAgent');
    await prisma.loginEvent.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000) }, // 10h ago
    });

    const withinWindow = await detectSessionAnomaly({ userId: user.id, currentIp: '203.0.113.10', lookbackHours: 24 });
    expect(withinWindow.anomalous).toBe(false);

    const outsideWindow = await detectSessionAnomaly({ userId: user.id, currentIp: '203.0.113.10', lookbackHours: 1 });
    expect(outsideWindow.anomalous).toBe(true);
  });
});

describe('resolveGeoLocation', () => {
  it('is an intentional not-implemented stub — always returns null', async () => {
    // Documents the current limitation rather than pretending a real geo
    // lookup exists — see the function's own comment. If a real provider
    // is ever wired in, this test should be the first thing updated.
    expect(await resolveGeoLocation('203.0.113.42')).toBeNull();
  });
});
