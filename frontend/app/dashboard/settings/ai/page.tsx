"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Zap, Plus, Trash2, CheckCircle2, AlertCircle, Cable, RefreshCw } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";

type AIProvider = "groq" | "tavily" | "gemini" | "openai";
type ChannelType = "whatsapp" | "email" | "messenger";
type AIMode = "manual" | "chatbot";

interface UserLLMConfig {
  id: string;
  provider: AIProvider;
  default_model: string | null;
  model_preferences: Record<ChannelType, string>;
}

interface ChatbotHealth {
  status: "ok" | "not_ready";
  workspace_id: string;
  config_count: number;
  chatbot_enabled: boolean;
  model_configured: boolean;
  model_valid?: boolean;
  provider: AIProvider | null;
  model: string | null;
}

interface AIConfigPayload {
  provider: AIProvider;
  api_key: string;
  api_url?: string;
  default_model?: string;
  model_preferences?: Record<ChannelType, string>;
  automation_modes?: Record<ChannelType, AIMode>;
}

const providerModels: Record<AIProvider, string[]> = {
  groq: [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
  ],
  tavily: ["default"],
  gemini: ["gemini-pro", "gemini-pro-vision"],
  openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
};

const providerInfo: Record<AIProvider, { label: string; help: string }> = {
  groq: {
    label: "Groq",
    help: "Fast inference API. Get free API key at console.groq.com",
  },
  tavily: {
    label: "Tavily",
    help: "Search + summarization. Get API key at tavily.com",
  },
  gemini: {
    label: "Google Gemini",
    help: "Google's multimodal LLM. Get API key at makersuite.google.com",
  },
  openai: {
    label: "OpenAI",
    help: "GPT-4 and more. Get API key at platform.openai.com",
  },
};

function fieldClass() {
  return "w-full rounded-xl border border-white/50 bg-white/50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:bg-white/10";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function AISettingsPage() {
  const pathname = usePathname();
  const [configs, setConfigs] = useState<UserLLMConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [apiServer, setApiServer] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [modelPreferences, setModelPreferences] = useState<Record<ChannelType, string>>({
    whatsapp: "",
    email: "",
    messenger: "",
  });
  const [modes, setModes] = useState<Record<ChannelType, AIMode>>({
    whatsapp: "chatbot",
    email: "manual",
    messenger: "chatbot",
  });
  const [loading, setLoading] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [health, setHealth] = useState<ChatbotHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadHealth() {
    setCheckingHealth(true);
    try {
      const response = await apiRequest<ChatbotHealth>("/health/chatbot");
      setHealth(response);
    } catch (err) {
      setHealth(null);
      setError((err as Error).message);
    } finally {
      setCheckingHealth(false);
    }
  }

  async function deleteConfig(id: string) {
    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/ai/config/${id}`, {
        method: "DELETE",
      });
      setNotice("Provider deleted successfully.");
      await loadConfigs();
      await loadHealth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadConfigs() {
    try {
      const response = await apiRequest<UserLLMConfig[]>("/ai/config");
      setConfigs(response);
      // hydrate UI with first matching provider config if present
      const current = response.find((c) => c.provider === selectedProvider) || response[0];
      if (current) {
        setDefaultModel(current.default_model || "");
        setModelPreferences((prev) => ({ ...prev, ...(current.model_preferences || {}) }));
        if ((current as any).automation_modes) {
          setModes((prev) => ({ ...prev, ...(current as any).automation_modes }));
        }
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadConfigs();
    void loadHealth();
  }, []);

  async function saveConfig() {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: AIConfigPayload = {
        provider: selectedProvider,
          api_key: apiKey,
          api_url: apiServer || undefined,
        default_model: defaultModel || undefined,
        model_preferences: Object.fromEntries(
          Object.entries(modelPreferences).filter(([_, v]) => v)
        ) as Record<ChannelType, string>,
          automation_modes: modes,
      };

      await apiRequest("/ai/config", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNotice(`${providerInfo[selectedProvider].label} configured successfully.`);
      setApiKey("");
      setApiServer("");
      setDefaultModel("");
      setModelPreferences({ whatsapp: "", email: "", messenger: "" });
      await loadConfigs();
      await loadHealth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const availableModels = providerModels[selectedProvider] || [];

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex items-center gap-2 border-b border-white/20 dark:border-white/10">
          <Link
            href="/dashboard/settings/channels"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
              pathname === "/dashboard/settings/channels"
                ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Cable size={16} />
            Channels
          </Link>
          <Link
            href="/dashboard/settings/ai"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
              pathname === "/dashboard/settings/ai"
                ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Zap size={16} />
            AI & Automation
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">
              Settings
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              AI & Automation
            </h1>
          </div>
          <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <Zap size={15} className="text-brand-500" />
            <span>{configs.length} provider(s) configured</span>
          </div>
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <RefreshCw size={15} className={checkingHealth ? "animate-spin" : ""} />
            <span>
              Chatbot {health?.status === "ok" ? "ready" : health ? "not ready" : "check"}
            </span>
          </button>
        </div>

        {health ? (
          <div
            className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm backdrop-blur-md ${
              health.status === "ok"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
            }`}
          >
            <div>
              <p className="font-semibold">
                {health.status === "ok" ? "Chatbot is ready" : "Chatbot not ready yet"}
              </p>
              <p className="text-xs opacity-80">
                {health.chatbot_enabled
                  ? `Provider ${health.provider || "unknown"}, model ${health.model || "unset"}`
                  : "Set messenger mode to chatbot and save a model to enable auto replies."}
              </p>
            </div>
            <div className="text-right text-xs opacity-80">
              <div>{health.config_count} config(s)</div>
              <div>{health.workspace_id}</div>
            </div>
          </div>
        ) : null}

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
          {/* Left: Configured Providers */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Configured Providers
              </h2>
            </div>
            <div className="divide-y divide-white/20 dark:divide-white/10">
              {configs.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No providers configured yet. Add one to get started.
                </div>
              ) : (
                configs.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                        <CheckCircle2 size={17} />
                      </span>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {providerInfo[config.provider].label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {config.default_model || "No default model"}
                        </p>
                        {config.provider === "groq" &&
                        config.default_model &&
                        !providerModels.groq.includes(config.default_model) ? (
                          <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                            Unsupported Groq model - delete and re-add with a current model.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {Object.keys(config.model_preferences || {}).length > 0 && (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          {Object.keys(config.model_preferences).length} platform(s)
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteConfig(config.id)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Add/Configure Provider */}
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <Zap size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Add Provider
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  API keys are encrypted.
                </p>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Provider
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(providerInfo) as AIProvider[]).map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(provider);
                        setDefaultModel(providerModels[provider]?.[0] || "");
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        selectedProvider === provider
                          ? "border-brand-300 bg-brand-500/20 text-brand-700 dark:text-brand-300"
                          : "border-white/30 bg-white/20 text-slate-600 hover:bg-white/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      {providerInfo[provider].label}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              {providerInfo[selectedProvider].help}
            </p>

            <div className="space-y-3">
              <Field label="API Server (optional)">
                <input
                  type="text"
                  value={apiServer}
                  onChange={(e) => setApiServer(e.target.value)}
                  className={fieldClass()}
                  placeholder="https://api.groq.ai"
                />
              </Field>

              <Field label="API Key">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={fieldClass()}
                  placeholder="sk-..."
                />
              </Field>

              <Field label="Default Model">
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">Select a model</option>
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="border-t border-white/20 pt-3 dark:border-white/10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Per-Platform Models
                </p>

                {(["whatsapp", "email", "messenger"] as ChannelType[]).map(
                  (channel) => (
                    <div key={channel} className="mb-3">
                      <label className="block">
                        <span className="mb-1.5 text-xs capitalize text-slate-600 dark:text-slate-300">
                          {channel}
                        </span>
                        <select
                          value={modelPreferences[channel] || ""}
                          onChange={(e) =>
                            setModelPreferences((prev) => ({
                              ...prev,
                              [channel]: e.target.value,
                            }))
                          }
                          className={fieldClass()}
                        >
                          <option value="">Use default</option>
                          {availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )
                )}
              </div>
            </div>

            <button
              onClick={() => void saveConfig()}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 disabled:opacity-60"
            >
              <Plus size={15} />
              {loading ? "Saving..." : "Save Provider"}
            </button>
          </div>
        </div>

        {/* Automation Settings */}
        <div className="mt-6 glass-card p-5">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
            Automation Modes
          </h2>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            Choose how AI responds for each platform:
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {(["whatsapp", "email", "messenger"] as ChannelType[]).map(
              (channel) => (
                <div
                  key={channel}
                  className="rounded-xl border border-white/20 bg-white/10 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <p className="mb-3 capitalize font-semibold text-slate-900 dark:text-white">
                    {channel}
                  </p>
                  <div className="space-y-2">
                    {(["manual", "chatbot"] as AIMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          setModes((prev) => ({
                            ...prev,
                            [channel]: mode,
                          }))
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                          modes[channel] === mode
                            ? "border-brand-300 bg-brand-500/20 text-brand-700 dark:text-brand-300"
                            : "border-white/30 text-slate-600 hover:bg-white/10 dark:border-white/10 dark:text-slate-300"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">
            <strong>Manual:</strong> Agent types response, AI assists.{" "}
            <strong>Chatbot:</strong> AI responds automatically.
          </p>
          {health?.model_valid === false ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              The saved Groq model is not in the supported list. Delete it and save again with a current model.
            </p>
          ) : null}
        </div>
      </section>
    </ProtectedPage>
  );
}
