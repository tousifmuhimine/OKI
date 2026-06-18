"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe, Mail, Phone, Save, Trash2, User, Users, Clock, Sparkles, TrendingUp, UserPlus, Activity, ShieldAlert } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Customer, CustomerProfileResponse, Lead } from "@/types/crm";

const stageBadge: Record<string, string> = {
  new: "bg-brand-500/20 text-brand-700 dark:bg-brand-500/30 dark:text-brand-300",
  active: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300",
  closed: "bg-white/40 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-white/20 dark:border-white/5",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function leadTone(lead: Lead) {
  const status = (lead.status || "").toLowerCase();
  if (status === "won") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "lost") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (status === "proposal" || status === "qualified") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-brand-500/15 text-brand-700 dark:text-brand-300";
}

export default function CustomerProfilePage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Customer>>({});

  async function loadProfile() {
    if (!customerId) return;
    setLoading(true);
    try {
      const response = await apiRequest<CustomerProfileResponse>(`/customers/${customerId}/profile`);
      setProfile(response);
      setDraft(response.customer);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, [customerId]);

  const latestLead = useMemo(() => profile?.related_leads?.[0] ?? null, [profile]);

  const timelineEvents = useMemo(() => {
    if (!profile) return [];
    const events: {
      id: string;
      type: "created" | "preference" | "lead";
      date: string;
      title: string;
      description: string;
      badgeText?: string;
      badgeStyle?: string;
    }[] = [];

    // 1. Customer Created
    events.push({
      id: `created-${profile.customer.id}`,
      type: "created",
      date: profile.customer.created_at,
      title: "Customer Created",
      description: `Customer record for ${profile.customer.company_name} was initialized in the database.`,
      badgeText: "System",
      badgeStyle: "bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-slate-500/20",
    });

    // 2. Preferences
    profile.preference_history.forEach((pref, index) => {
      events.push({
        id: `pref-${index}-${pref.detected_at}`,
        type: "preference",
        date: pref.detected_at,
        title: `Preference: ${pref.field_name.replace(/_/g, " ")}`,
        description: `Value detected as "${pref.new_value ?? "—"}" from ${pref.detected_from || "conversation"}.`,
        badgeText: `AI (${Math.round((pref.confidence ?? 0) * 100)}%)`,
        badgeStyle: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20",
      });
    });

    // 3. Related Leads
    profile.related_leads.forEach((lead) => {
      events.push({
        id: `lead-${lead.id}`,
        type: "lead",
        date: lead.updated_at,
        title: `Lead Status Update`,
        description: `Associated lead status updated to "${lead.status}" (Engagement: ${lead.engagement ?? "N/A"}). Summary: ${lead.last_summary || "None"}`,
        badgeText: lead.source || "System",
        badgeStyle: "bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 border border-brand-500/20",
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profile]);

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId) return;

    setSaving(true);
    setSuccess(null);
    try {
      const payload = {
        company_name: draft.company_name ?? profile?.customer.company_name,
        contact_person: draft.contact_person ?? null,
        email: draft.email ?? null,
        phone: draft.phone ?? null,
        address: draft.address ?? null,
        country_region: draft.country_region ?? null,
        assigned_user_id: draft.assigned_user_id ?? null,
        stage: draft.stage ?? profile?.customer.stage ?? "new",
        group_name: draft.group_name ?? null,
        tags: draft.tags ?? {},
        score: draft.score ?? 0,
        notes: draft.notes ?? null,
        type: draft.type ?? null,
      };
      const updated = await apiRequest<Customer>(`/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProfile((current) => (current ? { ...current, customer: updated } : current));
      setSuccess("Customer updated.");
      await loadProfile();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer() {
    if (!customerId || deleting) return;
    const confirmed = window.confirm("Delete this customer? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<void>(`/customers/${customerId}`, {
        method: "DELETE",
      });
      router.push("/customers");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/customers" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/50 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <ArrowLeft size={16} />
            Back to customers
          </Link>
          {latestLead ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leadTone(latestLead)}`}>
              Latest lead: {latestLead.status}
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {success}
          </p>
        ) : null}

        {loading ? (
          <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500 dark:text-slate-400">Loading customer profile...</div>
        ) : profile ? (
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <form onSubmit={saveCustomer} className="glass-card space-y-4 rounded-2xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Customer Profile</p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{profile.customer.company_name}</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Edit the customer record and review related lead history.</p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-brand-600 disabled:opacity-60"
                >
                  <Save size={15} />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteCustomer()}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <Trash2 size={15} />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Company name</label>
                  <input value={draft.company_name ?? ""} onChange={(e) => setDraft((current) => ({ ...current, company_name: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Contact person</label>
                  <input value={draft.contact_person ?? ""} onChange={(e) => setDraft((current) => ({ ...current, contact_person: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Email</label>
                  <input value={draft.email ?? ""} onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Phone</label>
                  <input value={draft.phone ?? ""} onChange={(e) => setDraft((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Address</label>
                  <textarea value={draft.address ?? ""} onChange={(e) => setDraft((current) => ({ ...current, address: e.target.value }))} className="min-h-24 w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Country / region</label>
                  <input value={draft.country_region ?? ""} onChange={(e) => setDraft((current) => ({ ...current, country_region: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Stage</label>
                  <input value={draft.stage ?? ""} onChange={(e) => setDraft((current) => ({ ...current, stage: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Type</label>
                  <input value={draft.type ?? ""} onChange={(e) => setDraft((current) => ({ ...current, type: e.target.value }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Score</label>
                  <input type="number" value={draft.score ?? 0} onChange={(e) => setDraft((current) => ({ ...current, score: Number(e.target.value) || 0 }))} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Notes</label>
                <textarea value={draft.notes ?? ""} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} className="min-h-28 w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
              </div>
            </form>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Snapshot</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Current profile state</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stageBadge[profile.customer.stage] ?? stageBadge.new}`}>{profile.customer.stage}</span>
                </div>
                <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2"><User size={14} /> {profile.customer.contact_person ?? "No contact person"}</div>
                  <div className="flex items-center gap-2"><Mail size={14} /> {profile.customer.email ?? "No email"}</div>
                  <div className="flex items-center gap-2"><Phone size={14} /> {profile.customer.phone ?? "No phone"}</div>
                  <div className="flex items-center gap-2"><Globe size={14} /> {profile.customer.country_region ?? "No region"}</div>
                  <div className="flex items-center gap-2"><Building2 size={14} /> {profile.customer.type ?? "No company type"}</div>
                  <div className="flex items-center gap-2"><Users size={14} /> Score {profile.customer.score}</div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Intelligence</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">AI Insights</h2>
                  </div>
                  <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{profile.conversation_count} conversations</span>
                </div>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="rounded-xl bg-white/40 p-3 dark:bg-black/20">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">AI summary</div>
                    <p className="mt-1">{profile.ai_summary ?? "No summary available yet."}</p>
                  </div>
                  <div className="rounded-xl bg-white/40 p-3 dark:bg-black/20">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Trust level</div>
                    <p className="mt-1">{profile.trust_level ?? "Unknown"}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Timeline</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Activity History</h2>
                  </div>
                  <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{timelineEvents.length} events</span>
                </div>

                <div className="relative pl-6 border-l-2 border-slate-200 dark:border-white/10 space-y-6 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                  {timelineEvents.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No activity logged yet.</p>
                  ) : (
                    timelineEvents.map((event) => {
                      let EventIcon = Activity;
                      let iconColor = "text-brand-500 bg-brand-500/10 border-brand-500/20";
                      if (event.type === "created") {
                        EventIcon = UserPlus;
                        iconColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                      } else if (event.type === "preference") {
                        EventIcon = Sparkles;
                        iconColor = "text-purple-500 bg-purple-500/10 border-purple-500/20";
                      } else if (event.type === "lead") {
                        EventIcon = TrendingUp;
                        iconColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
                      }

                      return (
                        <div key={event.id} className="relative group transition-all hover:translate-x-1 duration-200 text-left">
                          {/* Timeline node icon */}
                          <div className={`absolute -left-[35px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-white dark:bg-slate-900 shadow-sm ${iconColor}`}>
                            <EventIcon size={12} />
                          </div>

                          {/* Event Content */}
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{event.title}</h3>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">{formatDate(event.date)}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{event.description}</p>
                            {event.badgeText && (
                              <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${event.badgeStyle}`}>
                                {event.badgeText}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </ProtectedPage>
  );
}
