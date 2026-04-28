"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Inbox, Mail, PenLine, RefreshCw, Search, Send, Settings } from "lucide-react";
import Link from "next/link";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import {
  ConversationListResponse,
  EmailComposePayload,
  InboxConversation,
  InboxIntegration,
  InboxMessage,
  IntegrationListResponse,
  MessageListResponse,
} from "@/types/crm";

function formatDate(value: string | null) {
  if (!value) return "No mail yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function fieldClass() {
  return "w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:bg-white/10";
}

function messageSubject(message: InboxMessage | null, fallback = "No subject") {
  const metadataSubject = message?.metadata?.email_subject;
  if (typeof metadataSubject === "string" && metadataSubject.trim()) return metadataSubject;
  const firstLine = message?.content.split("\n")[0] ?? "";
  if (firstLine.toLowerCase().startsWith("subject:")) return firstLine.slice(8).trim() || fallback;
  return fallback;
}

function messageBody(message: InboxMessage) {
  const lines = message.content.split("\n");
  if (lines[0]?.toLowerCase().startsWith("subject:")) {
    return lines.slice(lines[1] === "" ? 2 : 1).join("\n").trim();
  }
  return message.content;
}

export default function MailPage() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [integrations, setIntegrations] = useState<InboxIntegration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ inbox_id: "", to_email: "", to_name: "", subject: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0] ?? null;
  const latestMessage = messages[messages.length - 1] ?? null;
  const selectedSubject = messageSubject(latestMessage, selected?.last_message_preview ?? "No subject");

  async function loadIntegrations() {
    const response = await apiRequest<IntegrationListResponse>("/integrations?limit=50&offset=0");
    const emailIntegrations = response.data.filter((item) => item.channel_type === "email");
    setIntegrations(emailIntegrations);
    setCompose((current) => ({ ...current, inbox_id: current.inbox_id || emailIntegrations[0]?.id || "" }));
  }

  async function loadConversations() {
    const response = await apiRequest<ConversationListResponse>("/inbox/conversations?channel=email&limit=100&offset=0");
    setConversations(response.data);
    setSelectedId((current) => current && response.data.some((item) => item.id === current) ? current : response.data[0]?.id ?? null);
  }

  async function loadPage() {
    setLoading(true);
    try {
      await Promise.all([loadIntegrations(), loadConversations()]);
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

  useEffect(() => { void loadPage(); }, []);

  useEffect(() => {
    if (!selected?.id) {
      setMessages([]);
      return;
    }
    void loadMessages(selected.id);
  }, [selected?.id]);

  async function syncEmail() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest<{ imported: number; skipped: number; inboxes: number }>("/integrations/email/sync?limit=25", { method: "POST" });
      setNotice(`Synced ${result.inboxes} mailbox(es): ${result.imported} imported, ${result.skipped} skipped.`);
      await loadConversations();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const subject = selectedSubject.toLowerCase().startsWith("re:") ? selectedSubject : `Re: ${selectedSubject}`;
      const message = await apiRequest<InboxMessage>(`/inbox/conversations/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: reply.trim(), metadata: { email_subject: subject } }),
      });
      setMessages((current) => [...current, message]);
      setReply("");
      await loadConversations();
      setNotice("Reply sent.");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function sendNewEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    try {
      const payload: EmailComposePayload = {
        inbox_id: compose.inbox_id || undefined,
        to_email: compose.to_email,
        to_name: compose.to_name || undefined,
        subject: compose.subject,
        content: compose.content,
        metadata: { email_subject: compose.subject },
      };
      const conversation = await apiRequest<InboxConversation>("/inbox/email/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadConversations();
      setSelectedId(conversation.id);
      setComposeOpen(false);
      setCompose({ inbox_id: integrations[0]?.id || "", to_email: "", to_name: "", subject: "", content: "" });
      setNotice("Email sent.");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
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
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">Mailbox</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Mail</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void syncEmail()}
              disabled={syncing || integrations.length === 0}
              className="glass-panel flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-white/60 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              Sync
            </button>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              disabled={integrations.length === 0}
              className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
            >
              <PenLine size={15} />
              Compose
            </button>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
        {notice ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p> : null}

        {integrations.length === 0 ? (
          <div className="glass-card grid min-h-[520px] place-items-center px-6 text-center">
            <div className="max-w-xl">
              <Mail className="mx-auto mb-4 text-amber-500" size={34} />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Connect a mailbox first</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Mail uses a dedicated email channel: IMAP reads incoming messages, SMTP sends replies and new emails. Add Gmail, Outlook, or a custom mailbox in channel settings, then return here to sync and work from this page.
              </p>
              <Link href="/dashboard/settings/channels" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600">
                <Settings size={15} />
                Open channel settings
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[calc(100vh-170px)] gap-4 xl:grid-cols-[340px_minmax(0,1fr)_300px]">
            <aside className="glass-card flex min-h-[520px] flex-col overflow-hidden">
              <div className="border-b border-white/20 p-4 dark:border-white/10">
                <div className="flex items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20">
                  <Search size={14} className="text-slate-500" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" placeholder="Search mail" type="search" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                  <div className="grid h-full place-items-center text-sm text-slate-500">Loading mail...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">No email threads yet. Sync your mailbox or compose the first email.</div>
                ) : (
                  filteredConversations.map((item) => (
                    <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`mb-1 flex w-full gap-3 rounded-xl p-3 text-left transition ${selected?.id === item.id ? "bg-amber-500/15 ring-1 ring-amber-300/40" : "hover:bg-white/40 dark:hover:bg-white/10"}`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                        <Mail size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.contact?.name ?? item.contact?.email ?? "Unknown sender"}</span>
                          <span className="shrink-0 text-[11px] text-slate-500">{formatDate(item.last_message_at)}</span>
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
                  <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selected.contact?.email ?? "No email address"}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white">{selectedSubject}</h2>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {messages.map((message) => {
                      const outgoing = message.message_type === "outgoing";
                      return (
                        <article key={message.id} className={`rounded-xl border px-4 py-3 ${outgoing ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10" : "border-white/40 bg-white/70 dark:border-white/10 dark:bg-white/10"}`}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{outgoing ? "You" : selected.contact?.name ?? selected.contact?.email ?? "Sender"}</span>
                            <span>{formatDate(message.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100">{messageBody(message)}</p>
                        </article>
                      );
                    })}
                  </div>
                  <form onSubmit={sendReply} className="border-t border-white/20 p-4 dark:border-white/10">
                    <div className="flex items-end gap-3 rounded-2xl border border-white/50 bg-white/50 p-2 dark:border-white/10 dark:bg-black/20">
                      <textarea value={reply} onChange={(event) => setReply(event.target.value)} className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" placeholder="Write a reply" />
                      <button type="submit" disabled={sending || !reply.trim()} aria-label="Send reply" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition hover:bg-amber-600 disabled:opacity-50">
                        <Send size={16} />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">Select an email thread to read it.</div>
              )}
            </main>

            <aside className="glass-card min-h-[520px] p-5">
              <div className="mb-5 flex items-center gap-2">
                <Inbox size={16} className="text-amber-500" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Mail setup</h2>
              </div>
              <div className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <p>Use Settings to add one or more email inboxes. IMAP pulls inbound mail into threads; SMTP sends replies and composed messages.</p>
                <p>For Gmail or Microsoft 365, use an app password or mailbox password allowed by the account policy.</p>
                <p>After connecting, press Sync here to import recent messages. New mail will appear as email threads, separate from Talk.</p>
              </div>
            </aside>
          </div>
        )}

        {composeOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
            <form onSubmit={sendNewEmail} className="glass-card w-full max-w-2xl p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New email</h2>
                <button type="button" onClick={() => setComposeOpen(false)} className="rounded-xl px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white/50 dark:text-slate-300 dark:hover:bg-white/10">Close</button>
              </div>
              <div className="space-y-3">
                <select value={compose.inbox_id} onChange={(event) => setCompose((current) => ({ ...current, inbox_id: event.target.value }))} className={fieldClass()} required>
                  {integrations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <input value={compose.to_email} onChange={(event) => setCompose((current) => ({ ...current, to_email: event.target.value }))} className={fieldClass()} placeholder="To email" type="email" required />
                <input value={compose.to_name} onChange={(event) => setCompose((current) => ({ ...current, to_name: event.target.value }))} className={fieldClass()} placeholder="Recipient name optional" />
                <input value={compose.subject} onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))} className={fieldClass()} placeholder="Subject" required />
                <textarea value={compose.content} onChange={(event) => setCompose((current) => ({ ...current, content: event.target.value }))} className={`${fieldClass()} min-h-48 resize-y`} placeholder="Write your message" required />
              </div>
              <button type="submit" disabled={sending} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50">
                <Send size={15} />
                {sending ? "Sending..." : "Send email"}
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </ProtectedPage>
  );
}
