export type ReflectionMode = 'reflection' | 'brainstorm' | 'summary' | 'action_plan' | 'deep_inquiry';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface JournalLocation {
  name: string;
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface InteractionEntry {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  messages: ChatMessage[];
  summary?: string;
  keyInsights?: string[];
  tags?: string[];
  mood?: string;
  location?: JournalLocation | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeInsight {
  name: string;
  count: number;
  description: string;
}

export interface InsightEntry {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  themes: ThemeInsight[] | string[];
  goals: string[];
  actionItems: Array<{ title: string; suggestedFrom?: string } | string>;
  recurringChallenges: string[];
  positivePatterns: string[];
  suggestedFocus: string;
  weeklyReflection?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ActionItemStatus = 'open' | 'completed';

export interface ActionItemEntry {
  id: string;
  userId: string;
  title: string;
  sourceJournalId?: string;
  sourceJournalTitle?: string;
  status: ActionItemStatus;
  createdAt: string;
  completedAt?: string | null;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface GenerateAIRequest {
  mode: ReflectionMode;
  messages: ChatMessage[];
  currentInput: string;
  mood?: string;
}

export interface GenerateAIResponse {
  reply: string;
  summary: string;
  keyInsights: string[];
  suggestedTags: string[];
  extractedActions?: string[];
  modelUsed: string;
}

export interface GenerateInsightsResponse {
  themes: ThemeInsight[];
  goals: string[];
  actionItems: Array<{ title: string; suggestedFrom?: string }>;
  recurringChallenges: string[];
  positivePatterns: string[];
  suggestedFocus: string;
  weeklyReflection: string;
  periodStart: string;
  periodEnd: string;
  modelUsed: string;
}

