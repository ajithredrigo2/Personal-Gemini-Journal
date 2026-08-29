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
  extractedActions?: string[];
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

export type UserRole = 'member' | 'admin' | 'superadmin';

export interface UserRoleDocument {
  userId: string;
  role: UserRole;
  email?: string;
  displayName?: string;
  grantedAt: string;
  grantedBy?: string;
}

export type WebhookProvider = 'slack' | 'discord' | 'custom';
export type WebhookTrigger = 'all' | 'action_items_only' | 'action_plan_only' | 'deep_inquiry_only';

export interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  provider: WebhookProvider;
  url: string;
  enabled: boolean;
  trigger: WebhookTrigger;
  lastDispatchedAt?: string;
  lastStatus?: 'success' | 'failed';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType:
    | 'auth_login'
    | 'reflection_saved'
    | 'webhook_dispatched'
    | 'role_changed'
    | 'permission_denied'
    | 'permission_checked'
    | 'insight_generated'
    | 'location_attached';
  severity: 'info' | 'warn' | 'security';
  actorId: string;
  actorEmail?: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface PlatformMetrics {
  totalReflections: number;
  totalUsers: number;
  totalActionItems: number;
  activeWebhooks: number;
  modeDistribution: Record<ReflectionMode, number>;
  moodDistribution: Record<string, number>;
  averageTurnsPerSession: number;
  aiSuccessRatePercent: number;
  lastCalculatedAt: string;
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

