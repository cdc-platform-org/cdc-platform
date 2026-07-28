export type AgentStatus = 'TRIAL' | 'ACTIVE' | 'PAUSED';

export interface Agent {
  id: string;
  businessId: string;
  name: string;
  primaryColor: string;
  systemPrompt: string;
  allowedOrigins: string[];
  fallbackPhone: string | null;
  status: AgentStatus;
  trialEndsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  agentId: string;
  question: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentMessageRole = 'USER' | 'ASSISTANT';

export interface AgentMessage {
  id: string;
  conversationId: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
}

export interface AgentConversation {
  id: string;
  agentId: string;
  visitorRef: string;
  createdAt: string;
  messages: AgentMessage[];
}
