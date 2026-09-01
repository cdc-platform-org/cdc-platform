import prisma from '../prismaClient';

export async function incrementUsage(userId: string, type: 'lesson' | 'quiz' | 'rubric') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const isFreeUser = user.role === 'Free';
  const usageField = `${type}Count`;

  if (isFreeUser && user[usageField] >= user.freeLimit) {
    throw new Error('Usage limit reached. Please upgrade to VIP or Premium.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      [usageField]: { increment: 1 },
    },
  });
}
