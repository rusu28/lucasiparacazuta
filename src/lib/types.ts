export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckSlide {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  details?: string[];
}

export interface TaxiAgentProfile {
  id: string;
  name: string;
  style: string;
  modelHint: string;
  accent: string;
}
