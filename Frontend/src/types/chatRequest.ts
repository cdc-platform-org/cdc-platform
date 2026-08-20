export type ChatRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

interface ChatRequestParticipant {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
}

export interface ChatRequest {
  id: string;
  senderId: string;
  recipientId: string;
  status: ChatRequestStatus;
  introMessage: string | null;
  respondedAt: string | null;
  createdAt: string;
  sender?: ChatRequestParticipant;
  recipient?: ChatRequestParticipant;
}
