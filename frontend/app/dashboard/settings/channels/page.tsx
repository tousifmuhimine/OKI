"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AtSign, Cable, Camera, Mail, MessageCircle, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { ChannelType, InboxIntegration, IntegrationListResponse } from "@/types/crm";

const channelOptions: Array<{ type: ChannelType; label: string; icon: React.ElementType }> = [
  { type: "facebook", label: "Facebook", icon: MessageCircle },
  { type: "instagram", label: "Instagram", icon: Camera },
  { type: "whatsapp", label: "WhatsApp", icon: Smartphone },
  { type: "email", label: "Email", icon: Mail },
];

const emailProviderPresets: Record<string, { label: string; smtpHost: string; smtpPort: string; imapHost: string; imapPort: string; help: string }> = {
  gmail: {
    label: "Gmail / Google Workspace",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    help: "Use a Google app password. Normal Gmail passwords are blocked.",
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    smtpHost: "smtp.office365.com",
    smtpPort: "587",
    imapHost: "outlook.office365.com",
    imapPort: "993",
    help: "Use an app password or SMTP/IMAP password allowed by your tenant.",
  },
  custom: {
    label: "Custom mailbox",
    smtpHost: "",
    smtpPort: "587",
    imapHost: "",
    imapPort: "993",
    help: "Use the SMTP and IMAP details from your hosting or mail provider.",
  },
};

function fieldClass() {
  return "w-full rounded-xl border border-white/50 bg-white/50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:bg-white/10";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ChannelInstructions({ channelType }: { channelType: ChannelType }) {
  if (channelType === "email") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        Add the mailbox credentials here. SMTP is for sending replies. IMAP is for reading incoming mails into the inbox.
      </div>
    );
  }
  if (channelType === "facebook") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
        Create a Meta app and page access token, then connect your page here. Webhook URL: /api/v1/inbox/webhooks/facebook.
      </div>
    );
  }
  if (channelType === "instagram") {
    return (
      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/80 px-4 py-3 text-sm text-fuchsia-800 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-200">
        Create a Meta app, connect your Facebook Page, and provide your Instagram Business Account ID. Webhook URL: /api/v1/inbox/webhooks/instagram.
      </div>
    );
  }
  if (channelType === "whatsapp") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
        Use your WhatsApp Cloud API token, phone number ID, and business account ID. Webhook URL: /api/v1/inbox/webhooks/whatsapp.
      </div>
    );
  }
  return null;
}

export default function ChannelSettingsPage() {
  const [integrations, setIntegrations] = useState<InboxIntegration[]>([]);
  const [channelType, setChannelType] = useState<ChannelType>("facebook");
  const [name, setName] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(() => channelOptions.find((item) => item.type === channelType) ?? channelOptions[0], [channelType]);
  const SelectedIcon = selected.icon;

  async function loadIntegrations() {
    try {
      const response = await apiRequest<IntegrationListResponse>("/integrations?limit=50&offset=0");
      setIntegrations(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void loadIntegrations(); }, []);

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyEmailPreset(provider: string) {
    const preset = emailProviderPresets[provider] ?? emailProviderPresets.custom;
    setForm((current) => ({
      ...current,
      email_provider: provider,
      smtp_host: preset.smtpHost,
      smtp_port: preset.smtpPort,
      imap_host: preset.imapHost,
      imap_port: preset.imapPort,
      imap_mailbox: current.imap_mailbox || "INBOX",
    }));
  }

  function buildConfig() {
    if (channelType === "facebook") {
      return {
        page_access_token: form.page_access_token ?? "",
        page_id: form.page_id ?? "",
      };
    }
    if (channelType === "instagram") {
      return {
        page_access_token: form.page_access_token ?? "",
        page_id: form.page_id ?? "",
        instagram_business_account_id: form.instagram_business_account_id ?? "",
      };
    }
    if (channelType === "whatsapp") {
      return {
        api_token: form.api_token ?? "",
        phone_number_id: form.phone_number_id ?? "",
        business_account_id: form.business_account_id ?? "",
      };
    }
    return {
      smtp_host: form.smtp_host ?? "",
      smtp_port: form.smtp_port ?? "587",
      smtp_username: form.smtp_username ?? "",
      smtp_password: form.smtp_password ?? "",
      imap_host: form.imap_host ?? "",
      imap_port: form.imap_port ?? "993",
      imap_username: form.imap_username || form.smtp_username || "",
      imap_password: form.imap_password || form.smtp_password || "",
      imap_mailbox: form.imap_mailbox || "INBOX",
      imap_use_ssl: true,
    };
  }

  async function createIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest<InboxIntegration>("/integrations", {
        method: "POST",
        body: JSON.stringify({
          name: name || selected.label,
          channel_type: channelType,
          channel_config: buildConfig(),
        }),
      });
      setName("");
      setForm({});
      setNotice("Channel connected.");
      await loadIntegrations();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function syncEmail() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest<{ imported: number; skipped: number; inboxes: number }>("/integrations/email/sync?limit=25", {
        method: "POST",
      });
      setNotice(`Email sync complete: ${result.imported} imported, ${result.skipped} skipped from ${result.inboxes} mailbox(es).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function deleteIntegration(id: string) {
    try {
      await apiRequest<void>(`/integrations/${id}`, { method: "DELETE" });
      await loadIntegrations();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Settings</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Channels</h1>
          </div>
          <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <Cable size={15} className="text-brand-500" />
            <span>{integrations.length} connected</span>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 backdrop-blur-md dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
              <h2 className="font-semibold text-slate-900 dark:text-white">Connected channels</h2>
            </div>
            <div className="divide-y divide-white/20 dark:divide-white/10">
              {integrations.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No channels connected yet.</div>
              ) : (
                integrations.map((item) => {
                  const meta = channelOptions.find((option) => option.type === item.channel_type);
                  const Icon = meta?.icon ?? AtSign;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{item.channel_type} · credentials encrypted</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.channel_type === "email" ? (
                          <button
                            type="button"
                            onClick={() => void syncEmail()}
                            disabled={syncing}
                            aria-label="Sync email"
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-brand-500/10 hover:text-brand-600 disabled:opacity-50 dark:text-slate-400"
                          >
                            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void deleteIntegration(item.id)}
                          aria-label="Disconnect channel"
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <form onSubmit={createIntegration} className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <SelectedIcon size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Add channel</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Credentials are encrypted before storage.</p>
              </div>
            </div>

            <div className="mb-4">
              <ChannelInstructions channelType={channelType} />
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {channelOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => { setChannelType(option.type); setForm({}); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${channelType === option.type ? "border-brand-300 bg-brand-500/20 text-brand-700 dark:text-brand-300" : "border-white/30 bg-white/20 text-slate-600 hover:bg-white/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                  >
                    <Icon size={15} />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <Field label="Channel name">
                <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass()} placeholder="Sales inbox" />
              </Field>

              {channelType === "facebook" ? (
                <>
                  <Field label="Page access token">
                    <input required value={form.page_access_token ?? ""} onChange={(event) => updateField("page_access_token", event.target.value)} className={fieldClass()} placeholder="Meta page access token" />
                  </Field>
                  <Field label="Page ID">
                    <input required value={form.page_id ?? ""} onChange={(event) => updateField("page_id", event.target.value)} className={fieldClass()} placeholder="Connected page ID" />
                  </Field>
                </>
              ) : null}

              {channelType === "instagram" ? (
                <>
                  <Field label="Page access token">
                    <input required value={form.page_access_token ?? ""} onChange={(event) => updateField("page_access_token", event.target.value)} className={fieldClass()} placeholder="Meta page access token" />
                  </Field>
                  <Field label="Facebook Page ID">
                    <input required value={form.page_id ?? ""} onChange={(event) => updateField("page_id", event.target.value)} className={fieldClass()} placeholder="Connected Facebook page ID" />
                  </Field>
                  <Field label="Instagram Business Account ID">
                    <input required value={form.instagram_business_account_id ?? ""} onChange={(event) => updateField("instagram_business_account_id", event.target.value)} className={fieldClass()} placeholder="Instagram Business Account ID" />
                  </Field>
                </>
              ) : null}

              {channelType === "whatsapp" ? (
                <>
                  <Field label="Cloud API token">
                    <input required value={form.api_token ?? ""} onChange={(event) => updateField("api_token", event.target.value)} className={fieldClass()} placeholder="WhatsApp Cloud API token" />
                  </Field>
                  <Field label="Phone number ID">
                    <input required value={form.phone_number_id ?? ""} onChange={(event) => updateField("phone_number_id", event.target.value)} className={fieldClass()} placeholder="Phone number ID" />
                  </Field>
                  <Field label="Business account ID">
                    <input required value={form.business_account_id ?? ""} onChange={(event) => updateField("business_account_id", event.target.value)} className={fieldClass()} placeholder="Business account ID" />
                  </Field>
                </>
              ) : null}

              {channelType === "email" ? (
                <>
                  <Field label="Mailbox provider">
                    <select value={form.email_provider ?? ""} onChange={(event) => applyEmailPreset(event.target.value)} className={fieldClass()} required>
                      <option value="" disabled>Select provider</option>
                      {Object.entries(emailProviderPresets).map(([key, preset]) => (
                        <option key={key} value={key}>{preset.label}</option>
                      ))}
                    </select>
                  </Field>
                  {form.email_provider ? (
                    <p className="rounded-xl border border-white/30 bg-white/30 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      {emailProviderPresets[form.email_provider]?.help}
                    </p>
                  ) : null}
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Send mail</p>
                  <Field label="SMTP host">
                    <input required value={form.smtp_host ?? ""} onChange={(event) => updateField("smtp_host", event.target.value)} className={fieldClass()} placeholder="smtp.gmail.com" />
                  </Field>
                  <Field label="SMTP port">
                    <input required value={form.smtp_port ?? "587"} onChange={(event) => updateField("smtp_port", event.target.value)} className={fieldClass()} placeholder="587" type="number" />
                  </Field>
                  <Field label="SMTP username">
                    <input required value={form.smtp_username ?? ""} onChange={(event) => updateField("smtp_username", event.target.value)} className={fieldClass()} placeholder="you@company.com" />
                  </Field>
                  <Field label="SMTP password">
                    <input required value={form.smtp_password ?? ""} onChange={(event) => updateField("smtp_password", event.target.value)} className={fieldClass()} placeholder="App password or mailbox password" type="password" />
                  </Field>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Read inbox</p>
                  <Field label="IMAP host">
                    <input required value={form.imap_host ?? ""} onChange={(event) => updateField("imap_host", event.target.value)} className={fieldClass()} placeholder="imap.gmail.com" />
                  </Field>
                  <Field label="IMAP port">
                    <input required value={form.imap_port ?? "993"} onChange={(event) => updateField("imap_port", event.target.value)} className={fieldClass()} placeholder="993" type="number" />
                  </Field>
                  <Field label="IMAP username">
                    <input value={form.imap_username ?? ""} onChange={(event) => updateField("imap_username", event.target.value)} className={fieldClass()} placeholder="Blank uses SMTP username" />
                  </Field>
                  <Field label="IMAP password">
                    <input value={form.imap_password ?? ""} onChange={(event) => updateField("imap_password", event.target.value)} className={fieldClass()} placeholder="Blank uses SMTP password" type="password" />
                  </Field>
                  <Field label="Mailbox folder">
                    <input value={form.imap_mailbox ?? "INBOX"} onChange={(event) => updateField("imap_mailbox", event.target.value)} className={fieldClass()} placeholder="INBOX" />
                  </Field>
                </>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 disabled:opacity-60"
            >
              <Plus size={15} />
              {loading ? "Connecting..." : "Connect channel"}
            </button>
          </form>
        </div>
      </section>
    </ProtectedPage>
  );
}
