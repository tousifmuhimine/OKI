"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Wifi, WifiOff } from "lucide-react";

import { buildWebSocketUrl } from "@/lib/websocket";

export default function ChatWidget({ conversationId }: { conversationId: string }) {
  type WidgetMessage = { id: string; content: string; sender: "visitor" | "agent"; createdAt: number };

  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const canSend = useMemo(() => connected && draft.trim().length > 0, [connected, draft]);

  function pushMessage(content: string, sender: WidgetMessage["sender"]) {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        content,
        sender,
        createdAt: Date.now(),
      },
    ]);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      setConnecting(true);
      setConnected(false);
      const url = await buildWebSocketUrl(`/ws/conversations/${conversationId}`);
      if (!active) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        setConnecting(false);
        setConnected(true);
        setError(null);
        console.log("chat-widget: connected", url);
      });
      ws.addEventListener("message", (ev) => {
        try {
          const data = JSON.parse(ev.data) as { text?: string; message?: { content?: string; sender_type?: string } };
          const content = data.text ?? data.message?.content;
          if (content) {
            const sender: WidgetMessage["sender"] = data.message?.sender_type === "agent" ? "agent" : "visitor";
            pushMessage(content, sender);
          }
        } catch (e) {
          console.error(e);
        }
      });
      ws.addEventListener("close", () => {
        setConnecting(false);
        setConnected(false);
        console.log("chat-widget: disconnected");
      });
      ws.addEventListener("error", () => {
        setConnecting(false);
        setConnected(false);
        setError("Connection error. Refresh to reconnect.");
      });
    })();
    return () => {
      active = false;
      wsRef.current?.close();
    };
  }, [conversationId]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ content }));
    pushMessage(content, "visitor");
    setDraft("");
  }

  return (
    <div className="flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-slate-950 to-slate-800 px-4 py-3 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Website chat</p>
          <h2 className="mt-0.5 text-sm font-semibold">Live conversation</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${connected ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-200"}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connecting ? "Connecting" : connected ? "Live" : "Offline"}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-4">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-slate-500">
            <div className="max-w-44">
              <Sparkles size={18} className="mx-auto mb-2 text-cyan-500" />
              Say hello to start the conversation.
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === "visitor" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.sender === "visitor" ? "bg-slate-950 text-white" : "bg-white text-slate-800 border border-slate-200"}`}>
              {message.content}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            placeholder={connected ? "Write a message…" : "Connecting to chat…"}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        <p className="mt-2 text-[11px] text-slate-500">Messages are delivered through the live widget websocket.</p>
      </form>
    </div>
  );
}
