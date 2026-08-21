import { prisma } from '../lib/prisma';

// Closes any open Vacancy whose applicationDeadline has passed — applicants
// can no longer apply to a closed listing (see routes/vacancies.ts's POST
// /:id/applications, which already checks status === 'open'), and it drops
// out of the public GET / listing the same way a manually-closed vacancy
// does. Deliberately reuses the existing 'closed' status rather than adding
// a new VacancyStatus value: "no longer accepting applications" is exactly
// what 'closed' already means, whether an employer did it by hand or the
// deadline did it automatically.
//
// Gigs are NOT covered by this sweep — Gig.deadline means something
// different (a project completion/delivery target, not an
// applications-closing cutoff), so auto-closing on it would be wrong.
export async function expireOverdueVacancies(): Promise<{ closedIds: string[] }> {
  const overdue = await prisma.vacancy.findMany({
    where: { status: 'open', applicationDeadline: { lte: new Date() } },
    select: { id: true },
  });
  if (overdue.length === 0) return { closedIds: [] };

  await prisma.vacancy.updateMany({
    where: { id: { in: overdue.map((v) => v.id) } },
    data: { status: 'closed' },
  });
  return { closedIds: overdue.map((v) => v.id) };
}
