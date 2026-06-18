"use client";

import { useEffect, useState } from "react";
import { 
  Building2, Check, X, ShieldAlert, Sparkles, Filter, 
  Settings, Clock, RefreshCw, Calendar, ToggleLeft, ToggleRight,
  Layers, MessageSquare, Zap, BadgeAlert
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";

type OrganizationBilling = {
  id: string;
  company_name: string;
  plan_name: string;
  subscription_status: string;
  subscription_cycle: string;
  subscription_expires_at: string | null;
  chatbot_enabled: boolean;
  crm_enabled: boolean;
  lead_bulk_share_enabled: boolean;
  
  requested_plan_name: string | null;
  requested_subscription_cycle: string | null;
  requested_at: string | null;
};

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit state
  const [editingOrg, setEditingOrg] = useState<OrganizationBilling | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form states for manual adjustments
  const [planName, setPlanName] = useState("free");
  const [status, setStatus] = useState("active");
  const [cycle, setCycle] = useState("monthly");
  const [expiresAt, setExpiresAt] = useState("");
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [crmEnabled, setCrmEnabled] = useState(true);
  const [leadBulkShareEnabled, setLeadBulkShareEnabled] = useState(true);

  async function loadAllOrganizations() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<OrganizationBilling[]>("/organizations/all");
      setOrganizations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllOrganizations();
  }, []);

  async function handleApprove(orgId: string) {
    setActionLoading(`approve-${orgId}`);
    try {
      const updated = await apiRequest<OrganizationBilling>(`/organizations/${orgId}/billing/approve`, {
        method: "POST"
      });
      setOrganizations(orgs => orgs.map(o => o.id === orgId ? updated : o));
      if (editingOrg?.id === orgId) {
        setEditingOrg(updated);
      }
    } catch (err: any) {
      alert(err.message || "Failed to approve request");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(orgId: string) {
    if (!confirm("Are you sure you want to reject this upgrade request?")) return;
    setActionLoading(`reject-${orgId}`);
    try {
      const updated = await apiRequest<OrganizationBilling>(`/organizations/${orgId}/billing/reject`, {
        method: "POST"
      });
      setOrganizations(orgs => orgs.map(o => o.id === orgId ? updated : o));
      if (editingOrg?.id === orgId) {
        setEditingOrg(updated);
      }
    } catch (err: any) {
      alert(err.message || "Failed to reject request");
    } finally {
      setActionLoading(null);
    }
  }

  function openEditDrawer(org: OrganizationBilling) {
    setEditingOrg(org);
    setPlanName(org.plan_name);
    setStatus(org.subscription_status);
    setCycle(org.subscription_cycle);
    setExpiresAt(org.subscription_expires_at ? org.subscription_expires_at.split("T")[0] : "");
    setChatbotEnabled(org.chatbot_enabled);
    setCrmEnabled(org.crm_enabled);
    setLeadBulkShareEnabled(org.lead_bulk_share_enabled);
  }

  async function handleSaveAdjustments(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOrg) return;
    setActionLoading(`save-${editingOrg.id}`);
    try {
      const payload = {
        plan_name: planName,
        subscription_status: status,
        subscription_cycle: cycle,
        subscription_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        chatbot_enabled: chatbotEnabled,
        crm_enabled: crmEnabled,
        lead_bulk_share_enabled: leadBulkShareEnabled
      };
      
      const updated = await apiRequest<OrganizationBilling>(`/organizations/${editingOrg.id}/billing`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      
      setOrganizations(orgs => orgs.map(o => o.id === editingOrg.id ? updated : o));
      setEditingOrg(null);
    } catch (err: any) {
      alert(err.message || "Failed to save adjustments");
    } finally {
      setActionLoading(null);
    }
  }

  // Filtered List
  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.company_name.toLowerCase().includes(searchQuery.toLowerCase()) || org.id.includes(searchQuery);
    const matchesPending = !filterPendingOnly || !!org.requested_plan_name;
    return matchesSearch && matchesPending;
  });

  const pendingCount = organizations.filter(org => !!org.requested_plan_name).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Website Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Administrate tenant organizations, adjust feature accessibility, and approve subscription changes.
          </p>
        </div>
        <button 
          onClick={loadAllOrganizations} 
          className="flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold self-start sm:self-auto transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 p-5 backdrop-blur-xl flex items-center gap-4">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Building2 size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Tenants</span>
            <span className="text-xl font-extrabold">{organizations.length} organizations</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 p-5 backdrop-blur-xl flex items-center gap-4">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Pending Plan Requests</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{pendingCount} requests</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 p-5 backdrop-blur-xl flex items-center gap-4">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Subscriptions</span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {organizations.filter(o => o.plan_name !== "free" && o.subscription_status === "active").length} paid
            </span>
          </div>
        </div>
      </div>

      {/* Filters & search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-white/40 dark:bg-slate-900/40 border border-white/25 dark:border-white/10 p-4 rounded-2xl backdrop-blur-md">
        <input 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by organization name or UUID..."
          className="h-10 w-full sm:max-w-md rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-4 text-sm outline-none focus:border-indigo-500"
        />
        
        <button 
          onClick={() => setFilterPendingOnly(!filterPendingOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            filterPendingOnly 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
              : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
        >
          <Filter size={14} />
          <span>Pending Upgrades Only</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Organization Listing */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
          <Building2 className="mx-auto text-slate-400 mb-2" size={32} />
          <p className="text-sm text-slate-500">No organizations matching your search filters.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map(org => {
            const isPending = !!org.requested_plan_name;
            return (
              <div 
                key={org.id}
                className={`rounded-2xl border bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-6 flex flex-col justify-between space-y-5 transition-all ${
                  isPending 
                    ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)] ring-1 ring-amber-500/20' 
                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                {/* Header info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 dark:text-white line-clamp-1">{org.company_name}</h3>
                      <p className="text-[10px] text-slate-400 font-mono select-all mt-0.5">{org.id}</p>
                    </div>
                    
                    <span className={`rounded px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                      org.plan_name === 'premium' 
                        ? 'bg-violet-500/10 text-violet-500 border border-violet-500/20' 
                        : org.plan_name === 'enterprise'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : org.plan_name === 'basic'
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                    }`}>
                      {org.plan_name}
                    </span>
                  </div>

                  {/* Pending request banner */}
                  {isPending && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
                      <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                        <BadgeAlert size={14} className="shrink-0 mt-0.5" />
                        <span>Plan Change Requested</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Requested: <strong className="capitalize">{org.requested_plan_name}</strong> ({org.requested_subscription_cycle})
                        {org.requested_at && (
                          <div className="text-[9px] text-slate-400 mt-0.5">Submitted: {new Date(org.requested_at).toLocaleString()}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(org.id)}
                          disabled={actionLoading === `approve-${org.id}`}
                          className="flex-1 h-8 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-sm flex items-center justify-center gap-1"
                        >
                          {actionLoading === `approve-${org.id}` ? (
                            <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          ) : (
                            <>
                              <Check size={10} />
                              <span>Approve</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleReject(org.id)}
                          disabled={actionLoading === `reject-${org.id}`}
                          className="flex-1 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 border border-slate-200 dark:border-white/5"
                        >
                          {actionLoading === `reject-${org.id}` ? (
                            <span className="h-3 w-3 animate-spin rounded-full border border-slate-600 dark:border-slate-300 border-t-transparent" />
                          ) : (
                            <>
                              <X size={10} />
                              <span>Reject</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modules Indicators */}
                  <div className="h-px bg-slate-200 dark:bg-white/10" />

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Active Modules</span>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${org.crm_enabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 text-slate-400 line-through dark:bg-white/5'}`}>
                        <Layers size={10} />
                        <span>CRM</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${org.chatbot_enabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 text-slate-400 line-through dark:bg-white/5'}`}>
                        <MessageSquare size={10} />
                        <span>Chatbot</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${org.lead_bulk_share_enabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 text-slate-400 line-through dark:bg-white/5'}`}>
                        <Zap size={10} />
                        <span>Bulk Share</span>
                      </span>
                    </div>
                  </div>

                  {/* Expiration Details */}
                  {org.subscription_expires_at && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-2">
                      <Calendar size={12} className="text-slate-500" />
                      <span>Expires: {new Date(org.subscription_expires_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Edit Adjustments Trigger */}
                <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                  <button 
                    onClick={() => openEditDrawer(org)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition"
                  >
                    <Settings size={12} />
                    <span>Adjust Plan</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Manual adjustments edit modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-bold">Manual Adjustment Console</h3>
                <p className="text-xs text-slate-500 mt-0.5">Customize features and billing settings for <strong>{editingOrg.company_name}</strong></p>
              </div>
              <button 
                onClick={() => setEditingOrg(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustments} className="space-y-5">
              
              {/* Billing Plan parameters */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500 block">Subscription Plan</span>
                  <select 
                    value={planName} 
                    onChange={e => setPlanName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 text-sm outline-none text-slate-800 dark:text-white"
                  >
                    <option value="free">Free Trial</option>
                    <option value="basic">Basic CRM</option>
                    <option value="premium">Premium Pro</option>
                    <option value="enterprise">Enterprise Max</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500 block">Billing Cycle</span>
                  <select 
                    value={cycle} 
                    onChange={e => setCycle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 text-sm outline-none text-slate-800 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500 block">Subscription Status</span>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 text-sm outline-none text-slate-800 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="past_due">Past Due (Alert)</option>
                    <option value="trialing">Trialing</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500 block">Expiration Date</span>
                  <input 
                    type="date"
                    value={expiresAt} 
                    onChange={e => setExpiresAt(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 text-sm outline-none text-slate-800 dark:text-white"
                  />
                </label>
              </div>

              <div className="h-px bg-slate-200 dark:bg-white/10" />

              {/* Individual Feature Toggles */}
              <div className="space-y-3.5">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Feature Toggles</span>
                
                {/* CRM Core */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                  <div>
                    <h4 className="text-xs font-bold">CRM Core Workspace</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Toggle overall CRM table and pipeline access.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setCrmEnabled(!crmEnabled)}
                    className="text-indigo-500 transition hover:scale-105"
                  >
                    {crmEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-slate-400" />}
                  </button>
                </div>

                {/* Chatbot Automation */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                  <div>
                    <h4 className="text-xs font-bold">Groq AI Chatbot replies</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Activate autonomous messenger and WhatsApp bot replies.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setChatbotEnabled(!chatbotEnabled)}
                    className="text-indigo-500 transition hover:scale-105"
                  >
                    {chatbotEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-slate-400" />}
                  </button>
                </div>

                {/* Bulk Share */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                  <div>
                    <h4 className="text-xs font-bold">Single-Link Bulk Share</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Allow generating multi-lead workspaces from a single link.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLeadBulkShareEnabled(!leadBulkShareEnabled)}
                    className="text-indigo-500 transition hover:scale-105"
                  >
                    {leadBulkShareEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="flex-1 h-11 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `save-${editingOrg.id}`}
                  className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-1.5"
                >
                  {actionLoading === `save-${editingOrg.id}` ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span>Save Adjustments</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

AdminOrganizationsPage.getLayout = (page: React.ReactElement) => (
  <ProtectedPage permissions={["permissions.manage"]}>{page}</ProtectedPage>
);
