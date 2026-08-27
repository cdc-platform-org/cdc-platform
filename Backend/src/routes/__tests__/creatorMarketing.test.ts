import { LaunchKitTargetType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { assertOwnedTarget, OwnershipError } from '../creatorMarketing';
import { createUser, createCourse, createDigitalProduct } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

// Regression + security coverage for the creator-facing Launch Kit routes'
// one real authorization boundary: a creator may only touch a LaunchKit for
// a product/course they themselves own (submittedById/instructorId), never
// someone else's — even though there's no role/billing gate at all (this
// tool is deliberately free, unlimited, ownership-gated only).
describe('creatorMarketing — assertOwnedTarget', () => {
  it('allows a Mentor to target their own course', async () => {
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id });
    await expect(assertOwnedTarget(LaunchKitTargetType.COURSE, course.id, instructor.id)).resolves.toBeUndefined();
  });

  it('rejects a Mentor targeting another Mentor\'s course (404, not 403 — never reveals it exists)', async () => {
    const owner = await createUser({ role: 'Mentor' });
    const stranger = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: owner.id });
    await expect(assertOwnedTarget(LaunchKitTargetType.COURSE, course.id, stranger.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects targeting an admin-authored course (instructorId null) — nobody "owns" it as a creator', async () => {
    const someUser = await createUser();
    const adminCourse = await createCourse({});
    await expect(assertOwnedTarget(LaunchKitTargetType.COURSE, adminCourse.id, someUser.id)).rejects.toBeInstanceOf(OwnershipError);
  });

  it('allows a seller to target their own digital product', async () => {
    const seller = await createUser({ isVerifiedGraduate: true });
    const product = await createDigitalProduct({ submittedById: seller.id });
    await expect(assertOwnedTarget(LaunchKitTargetType.DIGITAL_PRODUCT, product.id, seller.id)).resolves.toBeUndefined();
  });

  it('rejects a seller targeting another seller\'s digital product', async () => {
    const owner = await createUser({ isVerifiedGraduate: true });
    const stranger = await createUser({ isVerifiedGraduate: true });
    const product = await createDigitalProduct({ submittedById: owner.id });
    await expect(assertOwnedTarget(LaunchKitTargetType.DIGITAL_PRODUCT, product.id, stranger.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects a nonexistent target id', async () => {
    const someUser = await createUser();
    await expect(
      assertOwnedTarget(LaunchKitTargetType.DIGITAL_PRODUCT, '00000000-0000-0000-0000-000000000000', someUser.id)
    ).rejects.toBeInstanceOf(OwnershipError);
  });
});
