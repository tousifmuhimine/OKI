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
