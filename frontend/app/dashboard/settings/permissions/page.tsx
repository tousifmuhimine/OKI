"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Shield, Plus, Trash2, Users, Cable, Zap, ShieldAlert, Loader2, Sparkles, Settings2, CreditCard } from "lucide-react";

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

type TeamUser = {
  id: string;
  email: string | null;
  name: string | null;
  role_code: string | null;
};

const permissionOptions = [
  "leads.view",
  "leads.manage",
  "customers.view",
  "customers.manage",
  "tasks.view",
  "tasks.manage",
  "analytics.view",
  "chat.manage",
  "ai.settings",
  "permissions.manage",
] as const;

type PermissionKey = (typeof permissionOptions)[number];

export default function PermissionsSettingsPage() {
  const pathname = usePathname();
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [userId, setUserId] = useState("");
  const [permissionKey, setPermissionKey] = useState<PermissionKey>("customers.manage");
  const [isAllowed, setIsAllowed] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [updatingGrant, setUpdatingGrant] = useState<string | null>(null); // user_id:permission_key
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [grantsRes, usersRes] = await Promise.all([
        apiRequest<PermissionGrantListResponse>("/permissions?limit=150&offset=0"),
        apiRequest<TeamUser[]>("/organizations/users").catch(() => []),
      ]);
      setGrants(grantsRes.data);
      setUsers(usersRes);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Map user id to user details
  const userMap = useMemo(() => {
    const map = new Map<string, TeamUser>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  // Extract all unique user IDs that have grants or exist in team list
  const uniqueUserIds = useMemo(() => {
    const ids = new Set<string>();
    grants.forEach((g) => ids.add(g.user_id));
    users.forEach((u) => ids.add(u.id));
    return Array.from(ids);
  }, [grants, users]);

  // Map user_id -> permission_key -> Grant object
  const matrix = useMemo(() => {
    const map: Record<string, Record<string, PermissionGrant>> = {};
    uniqueUserIds.forEach((uid) => {
      map[uid] = {};
    });
    grants.forEach((g) => {
      if (map[g.user_id]) {
        map[g.user_id][g.permission_key] = g;
      }
    });
    return map;
  }, [grants, uniqueUserIds]);

  async function handleTogglePermission(targetUserId: string, key: PermissionKey, currentlyAllowed: boolean) {
    const ident = `${targetUserId}:${key}`;
    setUpdatingGrant(ident);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/permissions", {
        method: "POST",
        body: JSON.stringify({
          user_id: targetUserId,
          permission_key: key,
          is_allowed: !currentlyAllowed,
        }),
      });
      // Reload grants to reflect fresh database state
      const response = await apiRequest<PermissionGrantListResponse>("/permissions?limit=150&offset=0");
      setGrants(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingGrant(null);
    }
  }

  async function applyPreset(targetUserId: string, role: "super_admin" | "supervisor" | "agent") {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/permissions/presets", {
        method: "POST",
        body: JSON.stringify({
          user_id: targetUserId,
          role: role,
        }),
      });
      setNotice(`Preset '${role}' applied successfully.`);
      const response = await apiRequest<PermissionGrantListResponse>("/permissions?limit=150&offset=0");
      setGrants(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function clearAllUserPermissions(targetUserId: string) {
    const ok = window.confirm("Are you sure you want to clear all permissions for this user? They will fallback to default role permissions.");
    if (!ok) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const userGrants = grants.filter((g) => g.user_id === targetUserId);
      await Promise.all(
        userGrants.map((g) => apiRequest(`/permissions/${g.id}`, { method: "DELETE" }))
      );
      setNotice("User permissions cleared.");
      const response = await apiRequest<PermissionGrantListResponse>("/permissions?limit=150&offset=0");
      setGrants(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveManualGrant() {
    if (!userId.trim()) {
      setError("User selection is required");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/permissions", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId.trim(),
          permission_key: permissionKey,
          is_allowed: isAllowed,
        }),
      });
      setNotice("Permission granted successfully.");
      setUserId("");
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        {/* Navigation Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-white/20 dark:border-white/10 overflow-x-auto whitespace-nowrap scrollbar-none">
          <Link href="/dashboard/settings/channels" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/channels" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Cable size={16} /> Channels
          </Link>
          <Link href="/dashboard/settings/ai" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/ai" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Zap size={16} /> AI & Automation
          </Link>
          <Link href="/dashboard/settings/permissions" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/permissions" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Shield size={16} /> Permissions
          </Link>
          <Link href="/dashboard/settings/crm" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/crm" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Settings2 size={16} /> CRM Configuration
          </Link>
          <Link href="/dashboard/settings/billing" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${pathname === "/dashboard/settings/billing" ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <CreditCard size={16} /> Billing & Plan
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Settings</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Permissions Management Matrix</h1>
            <p className="text-xs text-slate-500 mt-1">Directly toggle fine-grained scopes or apply preset bundles to team members.</p>
          </div>
          <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <Users size={15} className="text-brand-500" />
            <span>{grants.length} active permission rules</span>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 backdrop-blur-md animate-fade-in">{error}</p> : null}
        {notice ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 backdrop-blur-md animate-fade-in">{notice}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          
          {/* ─── Permission Matrix Grid ────────────────────────── */}
          <div className="glass-card rounded-2xl overflow-hidden animate-scale-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/20 bg-white/30 dark:border-white/10 dark:bg-white/5 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-4 min-w-[200px]">Team Member</th>
                    {permissionOptions.map((opt) => (
                      <th key={opt} className="px-2 py-4 text-center font-medium font-mono text-[9px] lowercase" title={opt}>
                        {opt.split(".")[0]}<br />
                        <span className="font-bold uppercase text-[8px] text-brand-500 dark:text-brand-400">{opt.split(".")[1]}</span>
                      </th>
                    ))}
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-xs text-slate-700 dark:text-slate-300">
                  {loading && uniqueUserIds.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                        <Loader2 className="animate-spin inline mr-2 text-brand-500" size={16} />
                        Loading matrix data...
                      </td>
                    </tr>
                  ) : uniqueUserIds.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                        <ShieldAlert className="inline mr-2 text-slate-500" size={16} />
                        No permissions granted to any users yet. Use the sidebar to start.
                      </td>
                    </tr>
                  ) : (
                    uniqueUserIds.map((uid) => {
                      const user = userMap.get(uid);
                      const userName = user?.name || "Unknown User";
                      const userRole = user?.role_code?.replace("_", " ").toUpperCase() || "AGENT";
                      const userEmail = user?.email || uid;

                      return (
                        <tr key={uid} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 dark:text-white">{userName}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[180px]" title={userEmail}>{userEmail}</span>
                              <span className="inline-block mt-1 self-start rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/10">
                                {userRole}
                              </span>
                            </div>
                          </td>
                          {permissionOptions.map((opt) => {
                            const grant = matrix[uid]?.[opt];
                            const allowed = grant?.is_allowed ?? false;
                            const ident = `${uid}:${opt}`;
                            const isToggling = updatingGrant === ident;

                            return (
                              <td key={opt} className="px-2 py-3.5 text-center">
                                <div className="flex items-center justify-center">
                                  {isToggling ? (
                                    <Loader2 className="animate-spin text-brand-500" size={14} />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={allowed}
                                      onChange={() => void handleTogglePermission(uid, opt, allowed)}
                                      className="h-4 w-4 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer accent-brand-500 transition-all dark:border-white/10 dark:bg-black/20"
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="relative group/presets inline-block">
                                <button className="inline-flex items-center gap-1 rounded-lg px-2 h-7 border border-brand-500/20 hover:border-brand-500/50 bg-brand-500/5 text-[10px] font-semibold text-brand-600 dark:text-brand-400 transition cursor-pointer">
                                  <Sparkles size={11} /> Preset
                                </button>
                                <div className="absolute right-0 bottom-full z-10 hidden group-hover/presets:block mb-1 bg-white dark:bg-slate-900 border border-white/20 dark:border-white/10 rounded-xl shadow-xl p-1 w-28 text-left animate-fade-in">
                                  <button onClick={() => void applyPreset(uid, "agent")} className="w-full px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-[10px] text-slate-700 dark:text-slate-300 font-medium">Agent</button>
                                  <button onClick={() => void applyPreset(uid, "supervisor")} className="w-full px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-[10px] text-slate-700 dark:text-slate-300 font-medium">Supervisor</button>
                                  <button onClick={() => void applyPreset(uid, "super_admin")} className="w-full px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-[10px] text-slate-700 dark:text-slate-300 font-medium">Super Admin</button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void clearAllUserPermissions(uid)}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                                title="Reset permissions"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Sidebar Grant Controls ────────────────────────── */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5">
              <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={16} className="text-brand-500" />
                <span>Grant Custom Scope</span>
              </h2>
              <div className="space-y-4">
                <label className="block text-left">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Team Member</span>
                  <select 
                    value={userId} 
                    onChange={(e) => setUserId(e.target.value)} 
                    className="w-full h-10 px-3 rounded-xl border border-white/50 bg-white/60 text-xs text-slate-800 dark:text-slate-100 dark:border-white/10 dark:bg-black/20 outline-none focus:border-brand-400"
                  >
                    <option value="">-- Choose User --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email || u.id.slice(0, 8)} ({u.role_code || "Agent"})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-left">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scope Key</span>
                  <select 
                    value={permissionKey} 
                    onChange={(e) => setPermissionKey(e.target.value as PermissionKey)} 
                    className="w-full h-10 px-3 rounded-xl border border-white/50 bg-white/60 text-xs text-slate-800 dark:text-slate-100 dark:border-white/10 dark:bg-black/20 outline-none focus:border-brand-400"
                  >
                    {permissionOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center justify-between rounded-xl bg-slate-100/70 dark:bg-white/5 px-3 py-2.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Default Allowed</span>
                  <input 
                    type="checkbox" 
                    checked={isAllowed} 
                    onChange={(e) => setIsAllowed(e.target.checked)} 
                    className="h-4 w-4 accent-brand-500 cursor-pointer"
                  />
                </div>

                <button 
                  type="button" 
                  onClick={() => void saveManualGrant()} 
                  disabled={loading} 
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-brand-500 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-60 cursor-pointer shadow-glow-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  <span>Add/Update Scope</span>
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 text-left">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Preset Guide</h3>
              <ul className="text-[11px] text-slate-400 dark:text-slate-500 space-y-1.5 list-disc pl-4">
                <li><strong className="text-slate-600 dark:text-slate-300">Agent Preset</strong>: Grants leads/customers viewing, tasks managing, and mailbox chat.</li>
                <li><strong className="text-slate-600 dark:text-slate-300">Supervisor Preset</strong>: Grants managing leads/customers/tasks and analytics viewing.</li>
                <li><strong className="text-slate-600 dark:text-slate-300">Super Admin Preset</strong>: Grants full system settings, AI automation configs, and authorization matrix keys.</li>
              </ul>
            </div>
          </div>

        </div>
      </section>
    </ProtectedPage>
  );
}

