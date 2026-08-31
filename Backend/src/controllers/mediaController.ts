import axios from 'axios';

async function sendTelegramNotification(message: string): Promise<void> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8892590688:AAF3S-pJas7Q3715_f2d-q09HSjJoU-u4JY";
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "6061747331";

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram Bot Token or Chat ID is not configured.');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}
export async function submitDisputeFeedback(req: Request, res: Response): Promise<void> {
  const { userEmail, userName, problemDescription, lessonId } = req.body;

  // Format the notification message
  const timestamp = new Date().toISOString();
  const message = `*New Dispute/Feedback Submission*\n\n` +
                  `*User:* ${userName} (${userEmail})\n` +
                  `*Lesson/Task ID:* ${lessonId}\n` +
                  `*Description:* ${problemDescription}\n` +
                  `*Timestamp:* ${timestamp}`;

  // Send the notification to Telegram
  await sendTelegramNotification(message);

  // Respond to the client
  res.status(200).json({ message: 'Dispute/Feedback submitted successfully.' });
}
import { prisma } from '../prismaClient';

export async function updateUserProgress(req: Request, res: Response): Promise<void> {
  const { userId, xp, hearts, streak } = req.body;

  try {
    const updatedProgress = await prisma.employeeProgress.upsert({
      where: { employeeId: userId },
      update: { xp, hearts, streak },
      create: { employeeId: userId, xp, hearts, streak },
    });

    res.status(200).json({ message: 'Progress updated successfully.', progress: updatedProgress });
  } catch (error) {
    console.error('Error updating user progress:', error);
    res.status(500).json({ message: 'Failed to update progress.' });
  }
}
