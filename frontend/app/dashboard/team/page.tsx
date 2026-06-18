"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Mail, ShieldCheck, UserCircle, Trash2,
  RefreshCw, ChevronDown, BarChart2, CheckCircle, Clock,
  AlertTriangle, X, Loader2, UserPlus, Crown, GitMerge, MapPin, Briefcase, Award, ChevronRight,
  Building2
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ProtectedPage } from "@/components/protected-page";
import { Lead, LeadListResponse } from "@/types/crm";

// ─── Types ──────────────────────────────────────────────────────
type TeamUser = {
  id: string;
  email: string | null;
  name: string | null;
  role_id: string;
  role_code: string | null;
  reports_to_id: string | null;
  branch_id: string | null;
  permissions: string[];
  task_count: number;
  lead_count: number;
};

type Branch = {
  id: string;
  name: string;
  location: string | null;
};

const ROLE_PRESETS = [
  { code: "super_admin", label: "Super Admin" },
  { code: "branch_admin", label: "Branch Admin" },
  { code: "individual_agent", label: "Agent" },
  { code: "employee", label: "Employee" }
] as const;

const INDUSTRIES = [
  { code: "study_abroad", name: "Study Abroad", description: "Counselors, application, visa & ticket tracking" },
  { code: "ecommerce", name: "E-commerce", description: "Orders, packaging, shipping & return pipeline" },
  { code: "vendors_interior", name: "Vendors & Interior", description: "Requirements, proposals & project milestones" },
  { code: "real_estate", name: "Real Estate", description: "Site visits, inquiries & property bookings" },
] as const;

function roleColor(role: string | null) {
  switch (role) {
    case "super_admin":
    case "admin": return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20";
    case "branch_admin": return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20";
    case "supervisor": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20";
    case "individual_agent":
    case "agent": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20";
    case "employee": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20";
    default: return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/10";
  }
}

// ─── Recursive Tree Node Component ──────────────────────────────
function TreeNode({
  user,
  allUsers,
  level,
  onSelectUser,
  roleColor,
  branches
}: {
  user: TeamUser;
  allUsers: TeamUser[];
  level: number;
  onSelectUser: (u: TeamUser) => void;
  roleColor: (role: string | null) => string;
  branches: Branch[];
}) {
  const reportees = allUsers.filter(u => u.reports_to_id === user.id);
  const [isOpen, setIsOpen] = useState(true);

  const userBranchName = useMemo(() => {
    return branches.find(b => b.id === user.branch_id)?.name || "All Branches";
  }, [branches, user.branch_id]);

  return (
    <div className="relative my-3 pl-6 md:pl-10 border-l border-slate-200/60 dark:border-white/10">
      {/* Visual horizontal connector line */}
      <div className="absolute left-0 top-6 w-5 border-t border-slate-200/60 dark:border-white/10" />
      
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-2xl p-4 hover:bg-white/80 dark:hover:bg-black/35 transition shadow-sm max-w-2xl animate-fade-in">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 text-[11px] font-bold text-white shadow-inner">
            {(user.name || user.email || user.id)[0].toUpperCase()}
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {user.name || "Unnamed"}
              </p>
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${roleColor(user.role_code)}`}>
                {user.role_code?.replace("_", " ") || "Employee"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Mail size={11} className="text-slate-400" />
                {user.email}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={11} className="text-slate-400" />
                {userBranchName}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectUser(user)}
            className="rounded-xl bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-white/50 dark:border-white/5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
          >
            Manage
          </button>

          {reportees.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 transition"
            >
              {isOpen ? "Collapse" : `Expand (${reportees.length})`}
              <ChevronDown size={12} className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {isOpen && reportees.length > 0 && (
        <div className="mt-2 space-y-1">
          {reportees.map(rep => (
            <TreeNode
              key={rep.id}
              user={rep}
              allUsers={allUsers}
              level={level + 1}
              onSelectUser={onSelectUser}
              roleColor={roleColor}
              branches={branches}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function TeamDataPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  // Tab mode
  const [activeTab, setActiveTab] = useState<"directory" | "tree" | "workspace" | "performance">("directory");

  // Quota states (with localStorage persistence)
  const [targetLeads, setTargetLeads] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quota_target_leads");
      if (saved) return Number(saved) || 20;
    }
    return 20;
  });
  
  const [targetRevenue, setTargetRevenue] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quota_target_revenue");
      if (saved) return Number(saved) || 100000;
    }
    return 100000;
  });

  const [targetTasks, setTargetTasks] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quota_target_tasks");
      if (saved) return Number(saved) || 15;
    }
    return 15;
  });

  const saveQuotaTargets = (leads: number, revenue: number, tasks: number) => {
    setTargetLeads(leads);
    setTargetRevenue(revenue);
    setTargetTasks(tasks);
    if (typeof window !== "undefined") {
      localStorage.setItem("quota_target_leads", String(leads));
      localStorage.setItem("quota_target_revenue", String(revenue));
      localStorage.setItem("quota_target_tasks", String(tasks));
    }
  };

  // Dynamic leaderboard computed list
  const leaderboard = useMemo(() => {
    const agents = users.filter(u => u.role_code === "individual_agent" || u.role_code === "agent" || u.role_code === "employee" || !u.role_code);
    
    const entries = agents.map(a => {
      const mockRevenue = (a.lead_count * 12500) + (a.task_count * 2000);
      const leadsDone = a.lead_count;
      const tasksDone = a.task_count;
      
      return {
        id: a.id,
        name: a.name || a.email || "Unknown Agent",
        role: a.role_code || "Agent",
        leads: leadsDone,
        revenue: mockRevenue,
        tasks: tasksDone,
        performanceScore: (leadsDone * 10) + (mockRevenue / 5000) + (tasksDone * 5),
        isMock: false
      };
    });

    if (entries.length < 3) {
      const mockCompetitors = [
        { id: "mock-1", name: "Sarah Connor", role: "Agent", leads: 18, revenue: 165000, tasks: 12, performanceScore: 180 + 33 + 60, isMock: true },
        { id: "mock-2", name: "Tony Stark", role: "Agent", leads: 22, revenue: 240000, tasks: 19, performanceScore: 220 + 48 + 95, isMock: true },
        { id: "mock-3", name: "Bruce Wayne", role: "Agent", leads: 15, revenue: 145000, tasks: 14, performanceScore: 150 + 29 + 70, isMock: true }
      ];
      entries.push(...mockCompetitors);
    }

    return entries.sort((a, b) => b.performanceScore - a.performanceScore);
  }, [users]);

  // User details editing state
  const [editRole, setEditRole] = useState<string>("");
  const [editBranchId, setEditBranchId] = useState<string>("");
  const [editReportsToId, setEditReportsToId] = useState<string>("");
  const [savingUser, setSavingUser] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add user modal state
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("employee");
  const [newPassword, setNewPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Workspace settings state
  const [orgDetails, setOrgDetails] = useState<{
    id: string;
    company_name: string;
    organization_type_code: string | null;
    organization_type_name: string | null;
  } | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgType, setEditOrgType] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Branch creation state
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLocation, setNewBranchLocation] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<TeamUser[]>("/organizations/users");
      setUsers(res);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await apiRequest<Branch[]>("/organizations/branches");
      setBranches(res);
    } catch {
      // ignore
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await apiRequest<TeamUser>("/organizations/users/me");
      setCurrentUser(res);
    } catch {
      // ignore
    }
  };

  const fetchOrgDetails = async () => {
    try {
      const res = await apiRequest<{
        id: string;
        company_name: string;
        organization_type_code: string | null;
        organization_type_name: string | null;
      }>("/organizations/me");
      setOrgDetails(res);
      setEditOrgName(res.company_name);
      setEditOrgType(res.organization_type_code || "");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchUsers();
    void fetchBranches();
    void fetchCurrentUser();
    void fetchOrgDetails();
  }, []);

  // When selectedUser is set, initialize editing states
  useEffect(() => {
    if (selectedUser) {
      setEditRole(selectedUser.role_code || "employee");
      setEditBranchId(selectedUser.branch_id || "");
      setEditReportsToId(selectedUser.reports_to_id || "");
      setSaveError(null);
    }
  }, [selectedUser]);

  // Save changes to local user database
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    setSaveError(null);
    try {
      const res = await apiRequest<TeamUser>(`/organizations/users/${selectedUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role_code: editRole || null,
          branch_id: editBranchId || null,
          reports_to_id: editReportsToId || null,
        }),
      });
      // Update in local state
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...res } : u));
      setSelectedUser(prev => prev ? { ...prev, ...res } : null);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this team member? This action is permanent and will delete the user's account from Supabase and the local database.")) return;
    setSavingUser(true);
    setSaveError(null);
    try {
      await apiRequest(`/organizations/users/${userId}`, {
        method: "DELETE",
      });
      // Remove from local users state
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSelectedUser(null);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editOrgName.trim()) {
      setOrgError("Company name cannot be empty");
      return;
    }
    setSavingOrg(true);
    setOrgError(null);
    try {
      const res = await apiRequest<{
        id: string;
        company_name: string;
        organization_type_code: string | null;
        organization_type_name: string | null;
      }>("/organizations/me", {
        method: "PATCH",
        body: JSON.stringify({
          company_name: editOrgName.trim(),
          organization_type_code: editOrgType,
        }),
      });
      setOrgDetails(res);
      // If organization type code changes, update sessionStorage so module reloads correctly
      if (res.organization_type_code && typeof window !== "undefined") {
        sessionStorage.setItem("oki_org_type_code", res.organization_type_code);
      }
      alert("Workspace details updated successfully! Please reload the page if you changed the business industry module.");
    } catch (err) {
      setOrgError((err as Error).message);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) {
      setBranchError("Branch name is required");
      return;
    }
    setAddingBranch(true);
    setBranchError(null);
    try {
      const res = await apiRequest<Branch>("/organizations/branches", {
        method: "POST",
        body: JSON.stringify({
          name: newBranchName.trim(),
          location: newBranchLocation.trim() || null,
        }),
      });
      setBranches(prev => [...prev, res]);
      setShowAddBranch(false);
      setNewBranchName("");
      setNewBranchLocation("");
    } catch (err) {
      setBranchError((err as Error).message);
    } finally {
      setAddingBranch(false);
    }
  };

  // Group users by role code for directories
  const admins = useMemo(() => {
    return users.filter(u => u.role_code === "super_admin" || u.role_code === "admin");
  }, [users]);

  const branchAdmins = useMemo(() => {
    return users.filter(u => u.role_code === "branch_admin");
  }, [users]);

  const agents = useMemo(() => {
    return users.filter(u => u.role_code === "individual_agent" || u.role_code === "agent" || u.role_code === "supervisor");
  }, [users]);

  const employees = useMemo(() => {
    return users.filter(u => u.role_code === "employee" || (!u.role_code && u.role_id));
  }, [users]);

  // Compute Root Nodes for Hierarchy Tree (Users who have no valid supervisor in the list)
  const rootUsers = useMemo(() => {
    const userIds = new Set(users.map(u => u.id));
    return users.filter(u => !u.reports_to_id || !userIds.has(u.reports_to_id));
  }, [users]);

  // Compute lists of potential managers for reporting structure
  const potentialManagers = useMemo(() => {
    if (!selectedUser) return [];
    // Can report to any user EXCEPT themselves to avoid loops
    return users.filter(u => u.id !== selectedUser.id);
  }, [users, selectedUser]);

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newName.trim() || !newPassword.trim()) {
      setAddError("Email, name, and password are required");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          full_name: newName.trim(),
          role: newRole,
        }),
      });
      setShowAdd(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("employee");
      await fetchUsers();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const openUserProfile = async (user: TeamUser) => {
    setSelectedUser(user);
    setProfileLoading(true);
    setSelectedLeads([]);
    try {
      const response = await apiRequest<LeadListResponse>(`/leads?assigned_user_id=${encodeURIComponent(user.id)}&limit=20&offset=0&sort=desc`);
      setSelectedLeads(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Determine if active user is an administrator
  const isAuthorized = useMemo(() => {
    return currentUser?.role_code === "super_admin" || currentUser?.role_code === "admin" || currentUser?.role_code === "branch_admin";
  }, [currentUser]);

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              <Users size={20} className="inline mr-2 text-brand-500 animate-pulse" />
              Team Directory & Hierarchy
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Manage roles, branch locations, and organizational reporting lines.
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

        {/* View Mode Tabs */}
        <div className="mb-6 flex space-x-1 rounded-xl bg-slate-100 dark:bg-black/20 p-1 max-w-[640px] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "directory"
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Role Directories
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tree")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "tree"
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Hierarchy Tree
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workspace")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "workspace"
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Workspace & Branches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("performance")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "performance"
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Performance & Quotas
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-brand-500" size={24} />
          </div>
        ) : activeTab === "directory" ? (
          <div className="space-y-6">
            
            {/* ─── 1. ADMINS DIRECTORY ──────────────────────────────── */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "0ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Crown size={16} className="text-purple-500" />
                  Super Admin
                  <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    {admins.length}
                  </span>
                </div>
                {isAuthorized && currentUser?.role_code !== "branch_admin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole("super_admin");
                      setShowAdd(true);
                      setAddError(null);
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg bg-purple-500/20 px-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/30 transition dark:text-purple-300"
                  >
                    <Plus size={12} />
                    Add Super Admin
                  </button>
                )}
              </div>

              {admins.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Crown size={24} className="mb-3 opacity-30" />
                  No admins found.
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {admins.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => void openUserProfile(user)}
                      className="flex items-start gap-3 rounded-2xl border border-white/30 bg-white/40 p-4 text-left shadow-sm transition hover:bg-white/60 hover:shadow dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-[11px] font-bold text-white shadow-inner">
                        {(user.name || user.email || user.id)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {user.name || "Unnamed"}
                          </p>
                          <span className={`rounded-md px-1.5 py-0.2 text-[8px] font-bold uppercase ${roleColor(user.role_code)}`}>
                            {user.role_code?.replace("_", " ")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        
                        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} />
                            {branches.find(b => b.id === user.branch_id)?.name || "All Branches"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ─── 2. BRANCH ADMINS DIRECTORY ───────────────────────── */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "50ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Award size={15} className="text-blue-500" />
                  Branch Administrators
                  <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    {branchAdmins.length}
                  </span>
                </div>
                {isAuthorized && currentUser?.role_code !== "branch_admin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole("branch_admin");
                      setShowAdd(true);
                      setAddError(null);
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg bg-blue-500/20 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-500/30 transition dark:text-blue-300"
                  >
                    <Plus size={12} />
                    Add Branch Admin
                  </button>
                )}
              </div>

              {branchAdmins.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Award size={24} className="mb-3 opacity-30" />
                  No branch admins registered.
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {branchAdmins.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => void openUserProfile(user)}
                      className="flex items-start gap-3 rounded-2xl border border-white/30 bg-white/40 p-4 text-left shadow-sm transition hover:bg-white/60 hover:shadow dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-[11px] font-bold text-white shadow-inner">
                        {(user.name || user.email || user.id)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} />
                            {branches.find(b => b.id === user.branch_id)?.name || "Not Set"}
                          </span>
                          {user.reports_to_id && (
                            <span className="flex items-center gap-0.5">
                              <GitMerge size={10} />
                              Reports to: {users.find(u => u.id === user.reports_to_id)?.name || "Admin"}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ─── 3. CRM AGENTS DIRECTORY ─────────────────────────── */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Briefcase size={15} className="text-emerald-500" />
                  CRM Agents & Advisors
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {agents.length}
                  </span>
                </div>
                {isAuthorized && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole("individual_agent");
                      setShowAdd(true);
                      setAddError(null);
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/30 transition dark:text-emerald-300"
                  >
                    <Plus size={12} />
                    Add Agent
                  </button>
                )}
              </div>

              {agents.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Briefcase size={24} className="mb-3 opacity-30" />
                  No agents found.
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {agents.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => void openUserProfile(user)}
                      className="flex items-start gap-3 rounded-2xl border border-white/30 bg-white/40 p-4 text-left shadow-sm transition hover:bg-white/60 hover:shadow dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-indigo-500 text-[11px] font-bold text-white shadow-inner">
                        {(user.name || user.email || user.id)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} />
                            {branches.find(b => b.id === user.branch_id)?.name || "Not Set"}
                          </span>
                          {user.reports_to_id && (
                            <span className="flex items-center gap-0.5">
                              <GitMerge size={10} />
                              Reports to: {users.find(u => u.id === user.reports_to_id)?.name || "Admin"}
                            </span>
                          )}
                        </div>

                        {/* Counts badges */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                            <BarChart2 size={9} />
                            {user.task_count} tasks
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-500/10 px-2 py-0.5 text-[9px] font-semibold text-brand-700 dark:text-brand-300">
                            <Users size={9} />
                            {user.lead_count} leads
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ─── 4. EMPLOYEES DIRECTORY ──────────────────────────── */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "150ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <UserCircle size={14} className="text-indigo-500" />
                  Employees & Staff
                  <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                    {employees.length}
                  </span>
                </div>
                {isAuthorized && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole("employee");
                      setShowAdd(true);
                      setAddError(null);
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg bg-indigo-500/20 px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/30 transition dark:text-indigo-300"
                  >
                    <Plus size={12} />
                    Add Staff
                  </button>
                )}
              </div>

              {employees.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <UserCircle size={24} className="mb-3 opacity-30" />
                  No staff members registered.
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {employees.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => void openUserProfile(user)}
                      className="flex items-start gap-3 rounded-2xl border border-white/30 bg-white/40 p-4 text-left shadow-sm transition hover:bg-white/60 hover:shadow dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-[11px] font-bold text-white shadow-inner">
                        {(user.name || user.email || user.id)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} />
                            {branches.find(b => b.id === user.branch_id)?.name || "Not Set"}
                          </span>
                          {user.reports_to_id && (
                            <span className="flex items-center gap-0.5">
                              <GitMerge size={10} />
                              Reports to: {users.find(u => u.id === user.reports_to_id)?.name || "Admin"}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "tree" ? (
          /* ─── HIERARCHY TREE VIEW ───────────────────────────────── */
          <div className="glass-card p-6 animate-fade-up">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <GitMerge size={16} className="text-brand-500" />
              Organizational Chart
            </h2>
            {rootUsers.length === 0 ? (
              <p className="text-xs text-slate-500">No users found in hierarchy structure.</p>
            ) : (
              <div className="space-y-4 overflow-x-auto pb-4">
                {rootUsers.map((user) => (
                  <div key={user.id} className="relative pl-0 my-3">
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white/50 dark:bg-black/30 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm max-w-2xl">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-xs font-bold text-white shadow shadow-brand-500/20">
                          {(user.name || user.email || user.id)[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {user.name || "Unnamed"} (Root Owner)
                            </p>
                            <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase ${roleColor(user.role_code)}`}>
                              {user.role_code?.replace("_", " ") || "Super Admin"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openUserProfile(user)}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                      >
                        Manage
                      </button>
                    </div>
                    {/* Render children recursively */}
                    {users.filter(u => u.reports_to_id === user.id).map(rep => (
                      <TreeNode
                        key={rep.id}
                        user={rep}
                        allUsers={users}
                        level={1}
                        onSelectUser={openUserProfile}
                        roleColor={roleColor}
                        branches={branches}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "workspace" ? (
          /* ─── WORKSPACE & BRANCHES VIEW ─────────────────────────── */
          <div className="grid gap-6 md:grid-cols-2">
            {/* Workspace Profile Card */}
            <div className="glass-card p-6 animate-fade-up">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 size={18} className="text-brand-500" />
                Workspace Details
              </h2>
              {orgError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {orgError}
                </div>
              )}
              {orgDetails ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Organization ID
                    </label>
                    <p className="text-xs font-mono bg-slate-100 dark:bg-white/5 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-400 break-all select-all">
                      {orgDetails.id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Company Name
                    </label>
                    {isAuthorized ? (
                      <input
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:text-white"
                        placeholder="My Organization"
                      />
                    ) : (
                      <p className="font-semibold text-slate-900 dark:text-white">{orgDetails.company_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Business Industry Module
                    </label>
                    {isAuthorized ? (
                      <select
                        value={editOrgType}
                        onChange={(e) => setEditOrgType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:text-white"
                      >
                        <option value="">Select industry type</option>
                        {INDUSTRIES.map((ind) => (
                          <option key={ind.code} value={ind.code}>
                            {ind.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-semibold text-slate-900 dark:text-white">{orgDetails.organization_type_name || "None / General"}</p>
                    )}
                  </div>
                  {isAuthorized && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateOrg()}
                      disabled={savingOrg}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                    >
                      {savingOrg ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Save Workspace Details
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex justify-center items-center py-10 text-slate-500">
                  <Loader2 size={20} className="animate-spin text-brand-500" />
                </div>
              )}
            </div>

            {/* Branch Locations Card */}
            <div className="glass-card p-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin size={18} className="text-brand-500" />
                  Branch Locations
                </h2>
                {isAuthorized && currentUser?.role_code !== "branch_admin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBranch(true);
                      setBranchError(null);
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg bg-brand-500/20 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-500/30 transition dark:text-brand-300"
                  >
                    <Plus size={12} />
                    Add Branch
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {branches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    No branch locations registered. All operations are at Headquarters.
                  </div>
                ) : (
                  branches.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-slate-150 bg-white dark:border-white/10 dark:bg-white/5 p-4 shadow-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{b.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{b.location || "No Location Specified"}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ─── PERFORMANCE & QUOTAS VIEW ─────────────────────────── */
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* KPI Leaderboard */}
            <div className="glass-card p-6 animate-fade-up">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Award size={18} className="text-brand-500" />
                    Monthly Agent Leaderboard
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Real-time rankings based on leads, closed value, and task completions.</p>
                </div>
              </div>

              {/* Podium for Top 3 */}
              <div className="mb-8 grid grid-cols-3 gap-3 items-end pt-6 border-b border-white/10 pb-6">
                {/* 2nd place */}
                {leaderboard[1] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 ring-4 ring-slate-100 dark:ring-slate-800">
                        {leaderboard[1].name[0]}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[9px] font-bold text-white">2</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px]">{leaderboard[1].name}</p>
                    <span className="text-[10px] text-slate-400">Score {Math.round(leaderboard[1].performanceScore)}</span>
                  </div>
                )}

                {/* 1st place */}
                {leaderboard[0] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="relative -top-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-sm font-bold text-white ring-4 ring-amber-100 dark:ring-amber-500/20 shadow-glow-sm">
                        {leaderboard[0].name[0]}
                      </div>
                      <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500 w-5 h-5 animate-bounce" />
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">1</span>
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[110px]">{leaderboard[0].name}</p>
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">Score {Math.round(leaderboard[0].performanceScore)}</span>
                  </div>
                )}

                {/* 3rd place */}
                {leaderboard[2] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-700/20 text-xs font-bold text-amber-700 dark:text-amber-500 ring-4 ring-amber-700/10">
                        {leaderboard[2].name[0]}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-700 text-[9px] font-bold text-white">3</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px]">{leaderboard[2].name}</p>
                    <span className="text-[10px] text-slate-400">Score {Math.round(leaderboard[2].performanceScore)}</span>
                  </div>
                )}
              </div>

              {/* Leaderboard list */}
              <div className="space-y-4">
                {leaderboard.map((agent, index) => {
                  const leadPct = Math.min(Math.round((agent.leads / targetLeads) * 100), 100);
                  const revPct = Math.min(Math.round((agent.revenue / targetRevenue) * 100), 100);
                  
                  return (
                    <div key={agent.id} className="flex flex-col gap-2 rounded-2xl border border-white/30 bg-white/40 dark:border-white/5 dark:bg-white/5 p-4 transition-all hover:bg-white/60 dark:hover:bg-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-slate-400 w-5">#{index + 1}</span>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {agent.name}
                              {agent.isMock && (
                                <span className="text-[8px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded text-slate-500">Demo</span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{agent.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900 dark:text-white">BDT {agent.revenue.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{agent.leads} Leads · {agent.tasks} Tasks</p>
                        </div>
                      </div>

                      {/* Quota Progress Bars */}
                      <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-500">Leads Quota</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{leadPct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${leadPct}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-500">Revenue Quota</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{revPct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${revPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quota Targets Panel */}
            <div className="glass-card p-6 animate-fade-up" style={{ animationDelay: "50ms" }}>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart2 size={18} className="text-brand-500" />
                Customize Quotas
              </h2>
              <p className="text-xs text-slate-500 mb-6">Modify team target baselines. Quota progress bars on the leaderboard will adjust instantly.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Monthly Leads Target
                  </label>
                  <input
                    type="number"
                    value={targetLeads}
                    onChange={(e) => saveQuotaTargets(Number(e.target.value) || 1, targetRevenue, targetTasks)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Monthly Revenue Target (BDT)
                  </label>
                  <input
                    type="number"
                    value={targetRevenue}
                    onChange={(e) => saveQuotaTargets(targetLeads, Number(e.target.value) || 1, targetTasks)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Monthly Tasks Target
                  </label>
                  <input
                    type="number"
                    value={targetTasks}
                    onChange={(e) => saveQuotaTargets(targetLeads, targetRevenue, Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:text-white"
                  />
                </div>

                <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-4 text-xs text-brand-700 dark:text-brand-300">
                  <h3 className="font-bold flex items-center gap-1.5 mb-1">
                    <CheckCircle size={12} />
                    Auto-Persisted
                  </h3>
                  Monthly targets are automatically persisted for your workspace. Settings will reflect immediately on individual agent report panels.
                </div>
              </div>
            </div>
            
          </div>
        )}

        {/* ─── User Profile & Edit Hierarchy Sidebar ──────────────── */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-sm p-3">
            <div className="flex h-full w-full max-w-xl flex-col rounded-2xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-2xl dark:bg-slate-900/95 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-150 px-5 py-4 dark:border-white/10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">User Profile</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{selectedUser.name || selectedUser.email || selectedUser.id}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
                </div>
                <button type="button" onClick={() => setSelectedUser(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-150 bg-slate-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Tasks</div>
                  <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{selectedUser.task_count}</div>
                </div>
                <div className="rounded-2xl border border-slate-150 bg-slate-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Leads</div>
                  <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{selectedUser.lead_count}</div>
                </div>
                <div className="rounded-2xl border border-slate-150 bg-slate-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Permissions</div>
                  <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{selectedUser.permissions.length}</div>
                </div>
              </div>

              {/* ─── Hierarchy & Role Assignment Panel (Admins Only) ─── */}
              {isAuthorized && (
                <div className="mx-5 mb-5 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4 dark:border-brand-500/30">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                    <GitMerge size={14} />
                    Hierarchy & Role Assignment
                  </h3>

                  {saveError && (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                      {saveError}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Role Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Assign Role
                      </label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-slate-950/50 px-3 py-2 text-xs outline-none focus:border-brand-400 dark:text-white disabled:opacity-60"
                        disabled={currentUser?.id === selectedUser.id}
                      >
                        {ROLE_PRESETS.filter(preset => currentUser?.role_code !== "branch_admin" || (preset.code !== "super_admin" && preset.code !== "branch_admin")).map((preset) => (
                          <option key={preset.code} value={preset.code}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Branch Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Assign Branch
                      </label>
                      <select
                        value={editBranchId}
                        onChange={(e) => setEditBranchId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-slate-950/50 px-3 py-2 text-xs outline-none focus:border-brand-400 dark:text-white disabled:opacity-60"
                        disabled={currentUser?.role_code === "branch_admin"}
                      >
                        <option value="">All Branches / Corporate HQ</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.location || "No Location"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Supervisor (Reports To) Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Reports To (Supervisor)
                      </label>
                      <select
                        value={editReportsToId}
                        onChange={(e) => setEditReportsToId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-slate-950/50 px-3 py-2 text-xs outline-none focus:border-brand-400 dark:text-white"
                      >
                        <option value="">None (Independent / Top Level)</option>
                        {potentialManagers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.email} ({m.role_code?.replace("_", " ") || "User"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleUpdateUser()}
                      disabled={savingUser}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                    >
                      {savingUser ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      {savingUser ? "Saving changes..." : "Save Role & Hierarchy"}
                    </button>

                    {/* Delete Team Member Option */}
                    {currentUser && currentUser.id !== selectedUser.id && (
                      <div className="pt-3 border-t border-rose-500/10 mt-3">
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(selectedUser.id)}
                          disabled={savingUser}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 transition disabled:opacity-60"
                        >
                          <Trash2 size={12} />
                          Delete Team Member
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Assigned Leads Section */}
              <div className="px-5 pb-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assigned CRM Leads</h3>
                <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                  {profileLoading ? (
                    <div className="flex items-center justify-center py-10 text-brand-500"><Loader2 size={18} className="animate-spin" /></div>
                  ) : selectedLeads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      No leads are assigned to this user.
                    </div>
                  ) : selectedLeads.map((lead) => (
                    <div key={lead.id} className="rounded-2xl border border-slate-150 bg-white dark:border-white/10 dark:bg-white/5 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{lead.company_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{lead.contact_person || lead.email || lead.source || "Lead"}</p>
                        </div>
                        <span className="rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">{lead.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Add User/Admin Modal ──────────────────────────────── */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add {newRole === "super_admin" ? "Super Admin" : newRole === "branch_admin" ? "Branch Admin" : newRole === "individual_agent" ? "Agent" : "Staff Member"}
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
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    placeholder="colleague@company.com"
                    type="email"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Full Name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    placeholder="John Doe"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Password</span>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    placeholder="Min 8 characters"
                    type="password"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleAddUser()}
                  disabled={adding}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  {adding ? "Creating..." : `Add ${newRole === "super_admin" ? "Super Admin" : newRole === "branch_admin" ? "Branch Admin" : newRole === "individual_agent" ? "Agent" : "Staff Member"}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Add Branch Modal ───────────────────────────────────── */}
        {showAddBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Branch Location
                </h2>
                <button onClick={() => setShowAddBranch(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>

              {branchError && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {branchError}
                </div>
              )}

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Branch Name</span>
                  <input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    placeholder="e.g. Dhaka Branch"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Location (Optional)</span>
                  <input
                    value={newBranchLocation}
                    onChange={(e) => setNewBranchLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    placeholder="e.g. Road 12, Banani, Dhaka"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleAddBranch()}
                  disabled={addingBranch}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {addingBranch ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
                  {addingBranch ? "Creating..." : "Add Branch"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </ProtectedPage>
  );
}