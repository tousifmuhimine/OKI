export type PlatformChannelAnalytics = {
  channel_type: ChannelType;
  active_conversations: number;
  new_conversations: number;
  ai_events_count: number;
  handover_count: number;
  converted_leads_count: number;
};

export type DashboardSummary = {
  customers: number;
  leads: number;
  opportunities: number;
  products: number;
  orders: number;
  order_status_breakdown: Record<string, number>;
  payment_status_breakdown: Record<string, number>;
  lead_source_breakdown: Record<string, number>;
  converted_source_breakdown: Record<string, number>;
  platform_analytics: PlatformChannelAnalytics[];
};

export type Customer = {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country_region: string | null;
  assigned_user_id: string | null;
  stage: string;
  group_name: string | null;
  tags: Record<string, unknown>;
  score: number;
  last_contact_date: string | null;
  notes: string | null;
  type: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerPreference = {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  detected_from: string | null;
  confidence: number;
  detected_at: string;
};

export type CustomerLeadIntelligence = {
  lead_id: string;
  intent: string | null;
  engagement: string | null;
  trust_level: string | null;
  budget_min: number | null;
  budget_max: number | null;
  last_summary: string | null;
  updated_at: string;
};

export type CustomerProfileResponse = {
  customer: Customer;
  related_leads: Lead[];
  lead_intelligence: CustomerLeadIntelligence[];
  preference_history: CustomerPreference[];
  conversation_count: number;
  ai_summary: string | null;
  trust_level: string | null;
};

export type CustomerListResponse = {
  data: Customer[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type Lead = {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone?: string | null;
  address?: string | null;
  industry?: string | null;
  source: string | null;
  status: string;
  assigned_user_id: string | null;
  contact_id: string | null;
  inbox_id: string | null;
  conversation_id: string | null;
  capture_source: string | null;
  converted_customer_id: string | null;
  created_at: string;
  updated_at: string;
  // Dynamic industry-specific data (Real Estate / Study Abroad / Ecommerce)
  industry_data?: Record<string, unknown> | null;
  // Original agent input for audit trail
  raw_note?: string | null;
  // Agent who submitted the lead
  agent_id?: string | null;
  // Email stored at lead level
  email?: string | null;
  // New dynamic fields (Step 2)
  intent?: string | null;
  engagement?: string | null;
  trust_level?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  last_summary?: string | null;
  assigned_agent_id?: string | null;
};

export type LeadListResponse = {
  data: Lead[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type Order = {
  id: string;
  customer_id: string;
  handler_user_id: string | null;
  status: string;
  payment_status: string;
  total_amount: string;
  currency: string;
  remark: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderListResponse = {
  data: Order[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type ChannelType = "facebook" | "instagram" | "whatsapp" | "email" | "website" | "api";
export type ConversationStatus = "open" | "resolved" | "pending";
export type MessageType = "incoming" | "outgoing";
export type SenderType = "contact" | "agent";

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};

export type InboxIntegration = {
  id: string;
  workspace_id: string;
  name: string;
  is_bot_paused: boolean;
  assigned_user_id: string | null;
  channel_type: ChannelType;
  channel_config: Record<string, unknown>;
  created_at: string;
};

export type InboxContact = {
  id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  channel_identifiers: Record<string, unknown>;
  created_at: string;
};

export type InboxConversation = {
  id: string;
  workspace_id: string;
  inbox_id: string;
  contact_id: string;
  status: ConversationStatus;
  channel_type: ChannelType;
  last_message_at: string | null;
  created_at: string;
  contact: InboxContact | null;
  inbox: InboxIntegration | null;
  last_message_preview: string | null;
};

export type InboxMessage = {
  id: string;
  conversation_id: string;
  content: string;
  message_type: MessageType;
  sender_type: SenderType;
  sender_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ConversationListResponse = {
  data: InboxConversation[];
  meta: PaginationMeta;
};

export type MessageListResponse = {
  data: InboxMessage[];
  meta: PaginationMeta;
};

export type IntegrationListResponse = {
  data: InboxIntegration[];
  meta: PaginationMeta;
};

export type EmailComposePayload = {
  to_email: string;
  to_name?: string;
  subject: string;
  content: string;
  inbox_id?: string;
  metadata?: Record<string, unknown>;
};

export type Opportunity = {
  id: string;
  customer_id: string;
  title: string;
  stage: string;
  estimated_value: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type OpportunityListResponse = {
  data: Opportunity[];
  meta: PaginationMeta;
};
