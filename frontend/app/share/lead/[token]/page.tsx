"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Globe, Mail, Lock, ShieldAlert, ChevronRight,
  ArrowLeft, User, Tag, FileText, Calendar,
  ExternalLink, Clock, LogOut, Check
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type PublicLead = {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  priority: string | null;
  lead_stage_id: string | null;
  lead_source_id: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
};

type ShareLinkData = {
  id: string;
  is_public: boolean;
  expires_at: string | null;
  leads: PublicLead[];
};

export default function SharedLeadPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Verification states
  const [emailInput, setEmailInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  
  // Viewer states
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const savedEmailKey = `oki_share_email_${token}`;

  async function fetchSharedData(email?: string) {
    setLoading(true);
    setError(null);
    try {
      let url = `/public/leads/${token}`;
      const queryParams = new URLSearchParams();
      
      const emailToUse = email || (typeof window !== "undefined" ? sessionStorage.getItem(savedEmailKey) : null);
      if (emailToUse) {
        queryParams.set("email", emailToUse);
      }
      
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const res = await apiRequest<ShareLinkData>(url);
      setData(res);
      if (res.leads.length > 0) {
        setSelectedLeadId(res.leads[0].id);
      }
      setNeedsVerification(false);
      if (emailToUse && typeof window !== "undefined") {
        sessionStorage.setItem(savedEmailKey, emailToUse);
      }
    } catch (err: any) {
      if (err.message?.includes("Email required") || err.message?.includes("401")) {
        setNeedsVerification(true);
      } else {
        setError(err.message || "Failed to load shared workspace");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void fetchSharedData();
    }
  }, [token]);

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setVerifying(true);
    try {
      await fetchSharedData(emailInput.trim());
    } catch (err: any) {
      setError(err.message || "Failed to verify email");
    } finally {
      setVerifying(false);
    }
  }

  function handleCopy(text: string, id: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleLogout() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(savedEmailKey);
    }
    setData(null);
    setSelectedLeadId(null);
    setNeedsVerification(true);
  }

  if (loading && !verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400 font-medium">Loading secure workspace...</p>
        </div>
      </div>
    );
  }

  if (needsVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg">
              <Lock className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Verification Required</h1>
            <p className="mt-2 text-sm text-slate-400">This secure share link is restricted. Please enter your email to verify access.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-2xl">
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400" htmlFor="email">
                  Allowed Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="partner@company.com"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {verifying ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>Verify Email & Access</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-xl font-bold">Access Error</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <button
            onClick={() => fetchSharedData()}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const leadsList = data?.leads || [];
  const selectedLead = leadsList.find((l) => l.id === selectedLeadId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md">
            <span className="text-xs font-black tracking-widest text-white">OKI</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">OKI Shared Workspace</h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Globe size={10} className="text-indigo-400" />
              <span>{leadsList.length} shared lead{leadsList.length !== 1 ? 's' : ''}</span>
              {data?.expires_at && (
                <>
                  <span className="text-slate-600">•</span>
                  <Clock size={10} />
                  <span>Expires: {new Date(data.expires_at).toLocaleDateString()}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {!data?.is_public && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <LogOut size={12} />
            <span>Lock Workspace</span>
          </button>
        )}
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left list: visible on desktop, hidden on mobile if details are shown */}
        <div className={`w-full md:w-80 border-r border-white/10 flex flex-col shrink-0 ${showMobileDetails ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Leads List</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {leadsList.map((lead) => {
              const isActive = lead.id === selectedLeadId;
              return (
                <button
                  key={lead.id}
                  onClick={() => {
                    setSelectedLeadId(lead.id);
                    setShowMobileDetails(true);
                  }}
                  className={`w-full p-4 text-left transition flex items-center justify-between gap-3 ${
                    isActive ? 'bg-indigo-600/10 border-l-4 border-indigo-500' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{lead.company_name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{lead.contact_person || 'No Contact Person'}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-600 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right details pane: hidden on mobile if details not active */}
        <div className={`flex-1 flex flex-col overflow-y-auto ${!showMobileDetails ? 'hidden md:flex' : 'flex'}`}>
          {selectedLead ? (
            <div className="p-6 max-w-4xl w-full mx-auto space-y-6">
              {/* Back navigation for mobile */}
              <button
                onClick={() => setShowMobileDetails(false)}
                className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mb-4"
              >
                <ArrowLeft size={14} />
                <span>Back to List</span>
              </button>

              {/* Title & Status */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{selectedLead.company_name}</h2>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>Shared on {new Date(selectedLead.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-400 capitalize">
                    {selectedLead.status}
                  </span>
                  {selectedLead.priority && (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      selectedLead.priority === 'high' 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                        : selectedLead.priority === 'medium'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                    }`}>
                      {selectedLead.priority} priority
                    </span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Contact Information */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                    <User size={14} />
                    <span>Contact Info</span>
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Contact Person</span>
                      <span className="text-sm font-semibold text-white">{selectedLead.contact_person || 'N/A'}</span>
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Email</span>
                          <span className="text-sm font-semibold text-indigo-400 truncate block">{selectedLead.email}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(selectedLead.email!, 'email')}
                          className="rounded-lg bg-white/10 p-1.5 text-slate-400 hover:text-white transition shrink-0"
                        >
                          {copiedId === 'email' ? <Check size={12} className="text-emerald-400" /> : <ExternalLink size={12} />}
                        </button>
                      </div>
                    )}
                    {selectedLead.phone && (
                      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Phone</span>
                          <span className="text-sm font-semibold text-white truncate block">{selectedLead.phone}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(selectedLead.phone!, 'phone')}
                          className="rounded-lg bg-white/10 p-1.5 text-slate-400 hover:text-white transition shrink-0"
                        >
                          {copiedId === 'phone' ? <Check size={12} className="text-emerald-400" /> : <ExternalLink size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                    <Tag size={14} />
                    <span>Labels & Tags</span>
                  </h3>
                  
                  <div className="space-y-4">
                    {selectedLead.tags && selectedLead.tags.length > 0 ? (
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1.5">Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLead.tags.map((tag) => (
                            <span key={tag} className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs font-semibold text-indigo-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No tags associated with this lead.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <FileText size={14} />
                  <span>Notes & Comments</span>
                </h3>
                {selectedLead.notes ? (
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedLead.notes}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No additional notes shared for this lead.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500">
              Select a lead to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
