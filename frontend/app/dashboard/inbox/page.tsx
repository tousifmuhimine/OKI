"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AtSign,
  Camera,
  CheckCircle2,
  Filter,
  Globe2,
  Inbox,
  Mail,
  MessageCircle,
  Search,
  Send,
  Smartphone,
  RefreshCw,
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import {
  ChannelType,
  ConversationListResponse,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
  MessageListResponse,
} from "@/types/crm";

const statusTabs: Array<"all" | ConversationStatus> = ["all", "open", "resolved"];
const channels: Array<"all" | ChannelType> = ["all", "facebook", "instagram", "whatsapp", "email", "website"];

const channelMeta: Record<ChannelType, { label: string; icon: React.ElementType; tone: string }> = {
  facebook: { label: "Facebook", icon: MessageCircle, tone: "text-blue-500 bg-blue-500/10" },
  instagram: { label: "Instagram", icon: Camera, tone: "text-pink-500 bg-pink-500/10" },
  whatsapp: { label: "WhatsApp", icon: Smartphone, tone: "text-emerald-500 bg-emerald-500/10" },
  email: { label: "Email", icon: Mail, tone: "text-amber-500 bg-amber-500/10" },
  website: { label: "Website", icon: Globe2, tone: "text-cyan-500 bg-cyan-500/10" },
  api: { label: "API", icon: AtSign, tone: "text-slate-500 bg-slate-500/10" },
};

function formatTime(value: string | null) {
  if (!value) return "No messages";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ChannelBadge({ type }: { type: ChannelType }) {
  const meta = channelMeta[type];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${meta.tone}`}>
      <Icon size={14} />
    </span>
  );
}

function isSandboxMessage(message: InboxMessage) {
  const channelResult = message.metadata?.channel_result;
  if (!channelResult || typeof channelResult !== "object") return false;
  return (channelResult as { mode?: unknown }).mode === "sandbox";
}

function sandboxProviderLabel(message: InboxMessage) {
  const channelResult = message.metadata?.channel_result;
  if (!channelResult || typeof channelResult !== "object") return null;
  const provider = (channelResult as { provider?: unknown }).provider;
  return typeof provider === "string" && provider.trim() ? provider : null;
}

function InboxPageContent() {
  const searchParams = useSearchParams();
  const initialChannel = searchParams.get("channel");
  const [status, setStatus] = useState<"all" | ConversationStatus>("all");
  const [channel, setChannel] = useState<"all" | ChannelType>(
    channels.includes(initialChannel as "all" | ChannelType) ? (initialChannel as "all" | ChannelType) : "all",
  );
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0] ?? null;

  async function loadConversations() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (status !== "all") params.set("status", status);
      if (channel !== "all") params.set("channel", channel);
      const response = await apiRequest<ConversationListResponse>(`/inbox/conversations?${params.toString()}`);
      setConversations(response.data);
      setSelectedId((current) => current && response.data.some((item) => item.id === current) ? current : response.data[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const response = await apiRequest<MessageListResponse>(`/inbox/conversations/${conversationId}/messages?limit=100&offset=0`);
      setMessages(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void loadConversations(); }, [status, channel]);

  useEffect(() => {
    const nextChannel = searchParams.get("channel");
    if (channels.includes(nextChannel as "all" | ChannelType)) {
      setChannel(nextChannel as "all" | ChannelType);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selected?.id) {
      setMessages([]);
      return;
    }
    void loadMessages(selected.id);
  }, [selected?.id]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;

    setSending(true);
    try {
      const message = await apiRequest<InboxMessage>(`/inbox/conversations/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: draft.trim(), metadata: {} }),
      });
      setMessages((current) => [...current, message]);
      setDraft("");
      await loadConversations();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function syncEmail() {
    setSyncing(true);
    try {
      await apiRequest<{ imported: number; skipped: number; inboxes: number }>("/integrations/email/sync?limit=25", {
        method: "POST",
      });
      await loadConversations();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((item) =>
      [item.contact?.name, item.contact?.email, item.last_message_preview, item.inbox?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [conversations, query]);

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Communication Hub</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Inbox</h1>
          </div>
          <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => void syncEmail()}
              disabled={syncing}
              aria-label="Sync email"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-500 transition hover:bg-brand-500/10 disabled:opacity-50"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            </button>
            <Inbox size={15} className="text-brand-500" />
            <span>{conversations.length} conversations</span>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="grid min-h-[calc(100vh-170px)] gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="glass-card flex min-h-[520px] flex-col overflow-hidden">
            <div className="border-b border-white/20 p-4 dark:border-white/10">
              <div className="flex items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20">
                <Search size={14} className="text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  placeholder="Search conversations"
                  type="search"
                />
              </div>

              <div className="mt-3 flex overflow-hidden rounded-xl border border-white/30 bg-white/20 text-xs dark:border-white/10 dark:bg-white/5">
                {statusTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatus(tab)}
                    className={`h-8 flex-1 capitalize transition ${status === tab ? "bg-brand-500 font-semibold text-white" : "text-slate-600 hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/10"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                <Filter size={13} className="shrink-0 text-slate-500" />
                {channels.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChannel(item)}
                    className={`h-8 shrink-0 rounded-lg border px-3 text-xs font-medium capitalize transition ${channel === item ? "border-brand-300 bg-brand-500/20 text-brand-700 dark:text-brand-300" : "border-white/30 bg-white/20 text-slate-600 hover:bg-white/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">Loading inbox...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  Connect a channel and wait for inbound messages to start filling this list.
                </div>
              ) : (
                filteredConversations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`mb-1 flex w-full gap-3 rounded-xl p-3 text-left transition ${selected?.id === item.id ? "bg-brand-500/15 ring-1 ring-brand-300/40" : "hover:bg-white/40 dark:hover:bg-white/10"}`}
                  >
                    <ChannelBadge type={item.channel_type} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.contact?.name ?? "Unknown contact"}</span>
                        <span className="shrink-0 text-[11px] text-slate-500">{formatTime(item.last_message_at)}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.last_message_preview ?? item.inbox?.name ?? "No messages yet"}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="glass-card flex min-h-[520px] flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChannelBadge type={selected.channel_type} />
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{selected.contact?.name ?? "Unknown contact"}</h2>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{selected.inbox?.name ?? channelMeta[selected.channel_type].label} · {selected.contact?.email ?? selected.contact?.phone ?? "No contact detail"}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 size={12} />
                    {selected.status}
                  </span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {messages.length === 0 ? (
                    <div className="grid h-full place-items-center text-sm text-slate-500 dark:text-slate-400">No messages in this conversation yet.</div>
                  ) : (
                    messages.map((message) => {
                      const outgoing = message.message_type === "outgoing";
                      const sandbox = outgoing && isSandboxMessage(message);
                      const providerLabel = sandboxProviderLabel(message);
                      return (
                        <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${outgoing ? "bg-brand-500 text-white" : "bg-white/70 text-slate-800 dark:bg-white/10 dark:text-slate-100"}`}>
                            {sandbox ? (
                              <div className="mb-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Sandbox test{providerLabel ? ` · ${providerLabel}` : ""}
                              </div>
                            ) : null}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <p className={`mt-1 text-[10px] ${outgoing ? "text-white/70" : "text-slate-500"}`}>{formatTime(message.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendMessage} className="border-t border-white/20 p-4 dark:border-white/10">
                  <div className="flex items-end gap-3 rounded-2xl border border-white/50 bg-white/50 p-2 dark:border-white/10 dark:bg-black/20">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                      placeholder="Type your reply"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      aria-label="Send message"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-glow-sm transition hover:bg-brand-600 disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Select a conversation to view the thread.
              </div>
            )}
          </main>
        </div>
      </section>
    </ProtectedPage>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <ProtectedPage>
          <section className="grid min-h-[calc(100vh-54px)] place-items-center p-6 text-sm text-slate-500 dark:text-slate-400">
            Loading inbox...
          </section>
        </ProtectedPage>
      }
    >
      <InboxPageContent />
    </Suspense>
  );
}
