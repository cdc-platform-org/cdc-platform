import { NotificationService } from '@/src/services/notificationService';

export async function triggerNotification(eventType: string, payload: any) {
  switch (eventType) {
    case 'MENTORSHIP_BOOKING':
      await NotificationService.create({
        title: 'New Mentorship Session',
        message: `You have a new mentorship session booked.`,
        userId: payload.userId,
      });
      break;
    case 'TASK_ASSIGNMENT':
      await NotificationService.create({
        title: 'New Task Assigned',
        message: `A new task has been assigned to you.`,
        userId: payload.userId,
      });
      break;
    case 'TEST_GRADING':
      await NotificationService.create({
        title: 'Test Graded',
        message: `Your test has been graded.`,
        userId: payload.userId,
      });
      break;
    case 'CERTIFICATE_BADGE':
      await NotificationService.create({
        title: 'Certificate Earned',
        message: `Congratulations! You have earned a new certificate.`,
        userId: payload.userId,
      });
      break;
    default:
      console.warn(`Unhandled notification event type: ${eventType}`);
  }
}
