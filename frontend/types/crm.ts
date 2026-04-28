export type DashboardSummary = {
  customers: number;
  leads: number;
  opportunities: number;
  products: number;
  orders: number;
  order_status_breakdown: Record<string, number>;
  payment_status_breakdown: Record<string, number>;
};

export type Customer = {
  id: string;
  company_name: string;
  contact_person: string | null;
  country_region: string | null;
  assigned_user_id: string | null;
  stage: string;
  group_name: string | null;
  tags: Record<string, unknown>;
  score: number;
  last_contact_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  source: string | null;
  status: string;
  assigned_user_id: string | null;
  converted_customer_id: string | null;
  created_at: string;
  updated_at: string;
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
