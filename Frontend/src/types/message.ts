interface MessageParticipant {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'EnterpriseClient';
}

export interface ChatMessage {
  id: string;
  sender: MessageParticipant;
  recipient: MessageParticipant;
  content: string;
  wasFiltered: boolean;
  createdAt: string;
}
