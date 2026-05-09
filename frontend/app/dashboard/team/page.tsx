"use client";

import { useEffect, useState } from "react";
import {
  Users, Plus, Mail, ShieldCheck, UserCircle, Trash2,
  RefreshCw, ChevronDown, BarChart2, CheckCircle, Clock,
  AlertTriangle, X, Loader2, UserPlus, Crown,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ProtectedPage } from "@/components/protected-page";

// ─── Types ──────────────────────────────────────────────────────
type TeamUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  created_at: string | null;
  permissions: string[];
  task_count: number;
};

type TeamListResponse = {
  data: TeamUser[];
  total: number;
};

const ROLE_PRESETS = ["supervisor", "agent"] as const;

function roleColor(role: string | null) {
  switch (role) {
    case "admin": return "bg-purple-500/15 text-purple-700 dark:text-purple-300";
    case "supervisor": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "agent": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default: return "bg-slate-500/15 text-slate-600 dark:text-slate-400";
  }
}

export default function TeamDataPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addUserType, setAddUserType] = useState<"admin" | "member">("member");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("agent");
  const [newPassword, setNewPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<TeamListResponse>("/admin/users");
      setUsers(res.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  // Separate admins and regular users
  const admins = users.filter((u) => u.role === "admin");
  const regularUsers = users.filter((u) => u.role !== "admin");

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newName.trim() || !newPassword.trim()) {
      setAddError("Email, name, and password are required");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const roleToCreate = addUserType === "admin" ? "admin" : newRole;
      await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          full_name: newName.trim(),
          role: roleToCreate,
        }),
      });
      setShowAdd(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("agent");
      setAddUserType("member");
      await fetchUsers();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              <Users size={20} className="inline mr-2 text-brand-500" />
              Team Management
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Manage admins, team members, permissions, and task distribution
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchUsers()}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-brand-500" size={24} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ─── ADMINS SECTION ──────────────────────────────────── */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "0ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Crown size={16} className="text-purple-500" />
                  Administrators
                  <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    {admins.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddUserType("admin");
                    setShowAdd(true);
                    setAddError(null);
                  }}
                  className="flex h-8 items-center gap-1 rounded-lg bg-purple-500/20 px-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/30 transition dark:text-purple-300"
                >
                  <Plus size={12} />
                  Add Admin
                </button>
              </div>

              {admins.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Crown size={24} className="mb-3 opacity-30" />
                  No admins found.
                </div>
              ) : (
                <div className="divide-y divide-white/10 dark:divide-white/5">
                  {admins.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-white/30 dark:hover:bg-white/5">
                      {/* Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-[11px] font-bold text-white">
                        {(user.name || user.email || user.id)[0].toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {user.name || "Unnamed"}
                          </p>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${roleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {user.email || user.id.substring(0, 12)}
                        </p>
                      </div>

                      {/* Permissions chips */}
                      <div className="hidden sm:flex flex-wrap gap-1 max-w-[200px]">
                        {user.permissions.slice(0, 4).map((p) => (
                          <span key={p} className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-medium text-purple-700 dark:text-purple-300 truncate max-w-[100px]">
                            {p}
                          </span>
                        ))}
                        {user.permissions.length > 4 && (
                          <span className="text-[9px] text-slate-500">+{user.permissions.length - 4}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── TEAM MEMBERS SECTION ───────────────────────────── */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "80ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <UserCircle size={14} className="text-brand-500" />
                  Team Members
                  <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                    {regularUsers.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddUserType("member");
                    setNewRole("agent");
                    setShowAdd(true);
                    setAddError(null);
                  }}
                  className="flex h-8 items-center gap-1 rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-white hover:bg-brand-600 transition"
                >
                  <Plus size={12} />
                  Add Member
                </button>
              </div>

              {regularUsers.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Users size={28} className="mb-3 opacity-30" />
                  No team members found. Add your first member.
                </div>
              ) : (
                <div className="divide-y divide-white/10 dark:divide-white/5">
                  {regularUsers.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-white/30 dark:hover:bg-white/5">
                      {/* Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 text-[11px] font-bold text-white">
                        {(user.name || user.email || user.id)[0].toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {user.name || "Unnamed"}
                          </p>
                          {user.role && (
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${roleColor(user.role)}`}>
                              {user.role}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {user.email || user.id.substring(0, 12)}
                        </p>
                      </div>

                      {/* Permissions chips */}
                      <div className="hidden sm:flex flex-wrap gap-1 max-w-[200px]">
                        {user.permissions.slice(0, 4).map((p) => (
                          <span key={p} className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-medium text-brand-700 dark:text-brand-300 truncate max-w-[100px]">
                            {p}
                          </span>
                        ))}
                        {user.permissions.length > 4 && (
                          <span className="text-[9px] text-slate-500">+{user.permissions.length - 4}</span>
                        )}
                      </div>

                      {/* Task count badge */}
                      <div className="flex items-center gap-1.5 rounded-xl bg-white/30 dark:bg-white/5 px-2.5 py-1.5">
                        <BarChart2 size={11} className="text-slate-500" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{user.task_count}</span>
                        <span className="text-[9px] text-slate-500">tasks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Add User/Admin Modal ──────────────────────────────── */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {addUserType === "admin" ? "Add Administrator" : "Add Team Member"}
                </h2>
                <button onClick={() => setShowAdd(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>

              {addError && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {addError}
                </div>
              )}

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Email</span>
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="colleague@company.com"
                    type="email"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Full Name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="John Doe"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Password</span>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="Min 8 characters"
                    type="password"
                  />
                </label>

                {addUserType === "member" && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Role</span>
                    <div className="flex gap-2">
                      {ROLE_PRESETS.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewRole(role)}
                          className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${
                            newRole === role
                              ? "bg-brand-500 text-white"
                              : "border border-white/30 bg-white/40 text-slate-600 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </label>
                )}

                {addUserType === "admin" && (
                  <div className="rounded-xl border border-purple-200/30 bg-purple-50/30 dark:border-purple-500/20 dark:bg-purple-500/5 px-3 py-2.5 text-xs text-purple-700 dark:text-purple-300">
                    <p className="font-semibold mb-1">Administrator</p>
                    <p>This user will have full access to all permissions and can manage other administrators and team members.</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleAddUser()}
                  disabled={adding}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  {adding ? "Creating..." : `Add ${addUserType === "admin" ? "Admin" : "Member"}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </ProtectedPage>
  );
}