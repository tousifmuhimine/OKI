"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Clock,
  FileText,
  Upload,
  LogOut,
  CheckCircle,
  MessageCircle,
  FileUp,
  Sparkles,
  Key,
  ShieldAlert,
  Loader2
} from "lucide-react";

type Customer = {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country_region: string | null;
  stage: string;
  group_name: string | null;
  tags: string[];
  type?: string | null;
  last_education?: string | null;
  countries_applied?: string[] | null;
};

type Counselor = {
  name: string | null;
  email: string;
  role: string | null;
};

type TimelineItem = {
  id: string;
  item_type: string;
  activity_type: string | null;
  direction: string | null;
  platform: string | null;
  title: string | null;
  content: string | null;
  created_at: string;
};

type Document = {
  id: string;
  name: string;
  file_type: string;
  file_url: string;
  created_at: string;
};

export default function CustomerPortalDashboard() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [counselor, setCounselor] = useState<Counselor | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit profile states
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [countryRegion, setCountryRegion] = useState("");
  const [password, setPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [lastEducation, setLastEducation] = useState("");
  const [countriesApplied, setCountriesApplied] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState("");

  // File upload states
  const [uploadType, setUploadType] = useState("passport");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const addCountry = () => {
    if (newCountry.trim() && !countriesApplied.includes(newCountry.trim())) {
      setCountriesApplied([...countriesApplied, newCountry.trim()]);
      setNewCountry("");
    }
  };
  const removeCountry = (c: string) => {
    setCountriesApplied(countriesApplied.filter(item => item !== c));
  };

  const getCustomerToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("customer_portal_token");
    }
    return null;
  };

  const customerApiRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const token = getCustomerToken();
    const headers = new Headers(options.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("customer_portal_token");
          router.push("/customer-portal/login");
        }
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Request failed");
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, agentData, timelineData, docsData] = await Promise.all([
        customerApiRequest<any>("/customer-portal/me"),
        customerApiRequest<Counselor>("/customer-portal/agent").catch(() => ({ name: "Assigned Counselor", email: "support@oki.crm", role: "Counselor" })),
        customerApiRequest<TimelineItem[]>("/customer-portal/timeline"),
        customerApiRequest<Document[]>("/customer-portal/documents")
      ]);

      setCustomer(profileData);
      setCompanyName(profileData.company_name);
      setContactPerson(profileData.contact_person || "");
      setPhone(profileData.phone || "");
      setAddress(profileData.address || "");
      setCountryRegion(profileData.country_region || "");
      setLastEducation(profileData.last_education || "");
      setCountriesApplied(profileData.countries_applied || []);

      setCounselor(agentData);
      setTimeline(timelineData);
      setDocuments(docsData);
    } catch (err) {
      setError((err as Error).message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getCustomerToken();
    if (!token) {
      router.push("/customer-portal/login");
    } else {
      loadData();
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("customer_portal_token");
    localStorage.removeItem("customer_portal_user");
    router.push("/customer-portal/login");
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    setError(null);

    try {
      const payload: any = {
        company_name: companyName,
        contact_person: contactPerson,
        phone: phone,
        address: address,
        country_region: countryRegion,
        last_education: lastEducation,
        countries_applied: countriesApplied,
      };
      if (password) {
        payload.password = password;
      }

      const updated = await customerApiRequest<any>("/customer-portal/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setCustomer(updated);
      setLastEducation(updated.last_education || "");
      setCountriesApplied(updated.countries_applied || []);
      setPassword("");
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadSuccess(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file_type", uploadType);
      formData.append("file", selectedFile);

      const newDoc = await customerApiRequest<Document>("/customer-portal/documents/upload", {
        method: "POST",
        body: formData,
      });

      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedFile(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);

      // Reload timeline as uploading a document logs an activity
      const timelineData = await customerApiRequest<TimelineItem[]>("/customer-portal/timeline");
      setTimeline(timelineData);
    } catch (err) {
      setUploadError((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const getFullFileUrl = (relativeUrl: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
    const host = apiBase.replace("/api/v1", "");
    return `${host}${relativeUrl}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
        <span className="text-sm font-semibold tracking-wider uppercase text-slate-400">Loading Workspace...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 overflow-x-hidden relative">
      {/* Background Neon glows */}
      <div className="absolute top-0 right-1/4 w-[50rem] h-[50rem] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[50rem] h-[50rem] bg-pink-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Navbar / Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">OKI Customer Workspace</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">Portal</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 h-10 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-sm font-medium transition-all"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* Welcome Section */}
        <div className="mb-8 p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              Hello, {customer?.contact_person || customer?.company_name || "Client"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-400 font-medium">
              Track progress, review counseling activities, and upload documents.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status:</span>
            <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
              {customer?.stage || "active"}
            </span>
          </div>
        </div>

        {/* Progress Stepper */}
        {(() => {
          const getIndustryStages = (type: string | null) => {
            if (type === "study_abroad") {
              return [
                "Discovery", "Registration", "Document Submitted", "Document Approved",
                "Offer Letter Applied", "Offer Letter Received", "Interview Scheduled",
                "Interview Pass", "Medical Done", "Ticket & Fly"
              ];
            } else if (type === "vendors_interior") {
              return [
                "Discovery", "Requirements Taken", "Proposal", "Negotiation", "Working", "Finished"
              ];
            } else if (type === "ecommerce") {
              return [
                "New Order", "Confirmed", "Packed", "Shipped", "Delivered"
              ];
            } else {
              return [
                "Inquiry", "Site Visit", "Follow Up", "Negotiation", "Booking", "Payment", "Registration"
              ];
            }
          };

          const stagesList = getIndustryStages(customer?.type || null);
          const currentStageName = customer?.stage || "";
          const activeIndex = stagesList.findIndex(s => s.toLowerCase() === currentStageName.toLowerCase());
          
          return (
            <div className="mb-8 p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">Application Progress</h3>
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2 overflow-x-auto pb-4 pt-2 hide-scrollbar">
                {stagesList.map((stage, idx) => {
                  const isCompleted = idx < activeIndex;
                  const isActive = idx === activeIndex;
                  
                  return (
                    <div key={stage} className="flex-1 flex flex-col items-center min-w-[100px] relative text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold z-10 transition-all ${
                        isCompleted ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" :
                        isActive ? "bg-indigo-500 border-indigo-400 text-white animate-pulse shadow-lg shadow-indigo-500/30" :
                        "bg-slate-900 border-white/10 text-slate-500"
                      }`}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      
                      <span className={`mt-2 text-[10px] font-bold tracking-wide uppercase max-w-[90px] ${
                        isActive ? "text-indigo-400 font-extrabold" :
                        isCompleted ? "text-emerald-400" :
                        "text-slate-500"
                      }`}>
                        {stage}
                      </span>
                      
                      {idx < stagesList.length - 1 && (
                        <div className={`hidden md:block absolute left-[calc(50%+16px)] top-4 w-[calc(100%-32px)] h-0.5 -z-0 ${
                          idx < activeIndex ? "bg-emerald-500" : "bg-white/5"
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {error && (
          <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Counselor & Edit Profile */}
          <div className="space-y-8">
            
            {/* Counselor details */}
            <div className="p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Your Counselor</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">{counselor?.name || "Assigned Agent"}</h4>
                  <p className="text-xs text-slate-400 font-medium">{counselor?.role || "Counselor"}</p>
                </div>
              </div>
              <div className="mt-6 space-y-3.5 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <Mail size={15} className="text-slate-500" />
                  <span className="truncate">{counselor?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <MessageCircle size={15} className="text-slate-500" />
                  <a href={`mailto:${counselor?.email}`} className="text-indigo-400 hover:underline text-xs font-semibold">Email Counselor</a>
                </div>
              </div>
            </div>

            {/* Profile Settings */}
            <div className="p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Profile Details</h3>
              <form onSubmit={handleProfileSave} className="space-y-4">
                
                {profileSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs">
                    <CheckCircle size={14} />
                    <span>Profile updated successfully!</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Company/Client Name</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                  />
                </div>

                {customer?.type === "study_abroad" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Last Education</label>
                      <input
                        type="text"
                        placeholder="e.g. Bachelor of Science"
                        value={lastEducation}
                        onChange={(e) => setLastEducation(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Countries Applied For</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Canada"
                          value={newCountry}
                          onChange={(e) => setNewCountry(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCountry(); } }}
                          className="flex-1 h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                        />
                        <button
                          type="button"
                          onClick={addCountry}
                          className="h-10 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-xs font-bold text-white transition-all shrink-0"
                        >
                          Add
                        </button>
                      </div>
                      {countriesApplied.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {countriesApplied.map(c => (
                            <span key={c} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {c}
                              <button type="button" onClick={() => removeCountry(c)} className="hover:text-rose-400 font-bold ml-1 transition-colors">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Country/Region</label>
                    <input
                      type="text"
                      value={countryRegion}
                      onChange={(e) => setCountryRegion(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Address</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 outline-none focus:border-indigo-500/40 resize-none"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-1.5">
                    <Key size={10} />
                    <span>Change Portal Password</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full h-10 mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-xs text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {profileSaving ? <Loader2 size={14} className="animate-spin" /> : "Save Changes"}
                </button>
              </form>
            </div>
          </div>

          {/* Center Column: Timeline Tracker */}
          <div className="p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
              <Clock size={16} className="text-indigo-400" />
              <span>Application Timeline</span>
            </h3>

            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
                <Calendar size={32} className="mb-2 opacity-40" />
                <span className="text-xs">No updates yet. Timeline will populate as progress happens.</span>
              </div>
            ) : (
              <div className="relative border-l border-white/5 ml-3 pl-6 space-y-6">
                {timeline.map((item) => {
                  const date = new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const time = new Date(item.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div key={item.id} className="relative group">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 border border-indigo-500 shadow-md group-hover:scale-110 transition-transform">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      </span>

                      <div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-bold text-white tracking-tight">
                            {item.title || "Timeline Event"}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5">
                            <Clock size={10} />
                            <span>{date} at {time}</span>
                          </span>
                        </div>
                        {item.content && (
                          <p className="mt-1 text-xs text-slate-400 leading-relaxed font-medium">
                            {item.content}
                          </p>
                        )}
                        {item.platform && (
                          <span className="inline-block mt-2 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/5">
                            {item.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Document Manager & Upload */}
          <div className="space-y-8">
            
            {/* Upload Area */}
            <div className="p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <FileUp size={16} className="text-indigo-400" />
                <span>Upload Documents</span>
              </h3>

              <form onSubmit={handleFileUpload} className="space-y-4">
                {uploadSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs">
                    <CheckCircle size={14} />
                    <span>Document uploaded successfully!</span>
                  </div>
                )}
                {uploadError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Document Type</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-white/5 bg-slate-900 text-xs text-slate-200 outline-none focus:border-indigo-500/40"
                  >
                    <option value="passport">Passport</option>
                    <option value="nid">National ID (NID)</option>
                    <option value="ielts">IELTS / English Score Card</option>
                    <option value="hsc">HSC Certificate</option>
                    <option value="medical">Medical Report</option>
                    <option value="certificates">Academic Certificates / Certificates</option>
                    <option value="other">Other Supporting File</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 ml-1">Select File</label>
                  <div className="relative border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center bg-white/5 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all">
                    <input
                      type="file"
                      required
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload size={22} className="text-slate-400 mb-2" />
                    <span className="text-xs text-slate-300 text-center font-semibold truncate max-w-xs">
                      {selectedFile ? selectedFile.name : "Click to select a file"}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1">PDF, JPG, PNG, DOC (max 10MB)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-xs text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : "Upload Document"}
                </button>
              </form>
            </div>

            {/* Uploaded Documents List */}
            <div className="p-6 rounded-3xl border border-white/5 bg-white/5 shadow-xl backdrop-blur-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                <span>Uploaded Documents</span>
              </h3>

              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-center">
                  <FileText size={28} className="mb-1.5 opacity-40" />
                  <span className="text-xs">No documents uploaded yet.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const docDate = new Date(doc.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-white truncate max-w-[150px] md:max-w-[200px]" title={doc.name}>
                              {doc.name}
                            </span>
                            <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
                              {doc.file_type} • {docDate}
                            </span>
                          </div>
                        </div>
                        <a
                          href={getFullFileUrl(doc.file_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-400 transition-all"
                          title="View document"
                        >
                          <Globe size={13} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
