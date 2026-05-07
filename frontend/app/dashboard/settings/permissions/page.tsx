"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Shield, Plus, Trash2, Users, Cable, Zap } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";


type PermissionGrant = {
  id: string;
  workspace_id: string;
  user_id: string;
  permission_key: string;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
};

type PermissionGrantListResponse = {
  data: PermissionGrant[];
  meta: { total: number; limit: number; offset: number };
};

const permissionOptions = [
  "customers.manage",
  "leads.manage",
  "tasks.manage",
  "ai.settings",
  "permissions.manage",
] as const;

export default function PermissionsSettingsPage() {
  const pathname = usePathname();
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [userId, setUserId] = useState("");
  const [permissionKey, setPermissionKey] = useState<(typeof permissionOptions)[number]>("customers.manage");
  const [isAllowed, setIsAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadGrants() {
    try {
      const response = await apiRequest<PermissionGrantListResponse>("/permissions?limit=100&offset=0");
      setGrants(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadGrants();
  }, []);

  async function saveGrant() {
    if (!userId.trim()) {
      setError("User ID is required");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/permissions", {
        method: "POST",
        body: JSON.stringify({ user_id: userId.trim(), permission_key: permissionKey, is_allowed: isAllowed }),
      });
      setNotice("Permission updated.");
      setUserId("");
      setPermissionKey("customers.manage");
      setIsAllowed(true);
      await loadGrants();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteGrant(id: string) {
    setLoading(true);
    try {
      await apiRequest(`/permissions/${id}`, { method: "DELETE" });
      setNotice("Permission removed.");
      await loadGrants();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    return grants.reduce<Record<string, PermissionGrant[]>>((acc, grant) => {
      acc[grant.user_id] = acc[grant.user_id] || [];
      acc[grant.user_id].push(grant);
      return acc;
    }, {});
  }, [grants]);

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex items-center gap-2 border-b border-white/20 dark:border-white/10">
          <Link href="/dashboard/settings/channels" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/channels" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Cable size={16} /> Channels
          </Link>
          <Link href="/dashboard/settings/ai" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/ai" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Zap size={16} /> AI & Automation
          </Link>
          <Link href="/dashboard/settings/permissions" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/permissions" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Shield size={16} /> Permissions
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Settings</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Permissions</h1>
          </div>
          <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <Users size={15} className="text-brand-500" />
            <span>{grants.length} grant(s)</span>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
        {notice ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="glass-card rounded-2xl p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Grant permission</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">User ID</span>
                <input value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="target user id" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Permission</span>
                <select value={permissionKey} onChange={(e) => setPermissionKey(e.target.value as (typeof permissionOptions)[number])} className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white">
                  {permissionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/40 px-3 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <input type="checkbox" checked={isAllowed} onChange={(e) => setIsAllowed(e.target.checked)} />
                Allow permission
              </label>
              <button type="button" onClick={() => void saveGrant()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
                <Plus size={15} /> Save grant
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {Object.keys(grouped).length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-400">No permission grants yet.</div>
            ) : Object.entries(grouped).map(([uid, items]) => (
              <div key={uid} className="glass-card rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">User</p>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{uid}</h2>
                  </div>
                  <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{items.length} grant(s)</span>
                </div>
                <div className="space-y-2">
                  {items.map((grant) => (
                    <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{grant.permission_key}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{grant.is_allowed ? "Allowed" : "Denied"}</p>
                      </div>
                      <button type="button" onClick={() => void deleteGrant(grant.id)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}
