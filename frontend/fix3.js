const fs = require('fs');
let lines = fs.readFileSync('app/leads/page.tsx', 'utf8').split(/\r?\n/);

const renderLeadStart = lines.findIndex(l => l.includes('function renderLeadDetail(overlay = false) {'));
const protectedPageStart = lines.findIndex(l => l.includes('<ProtectedPage>'));

if (renderLeadStart !== -1 && protectedPageStart !== -1) {
    const newRenderLead = `  function renderLeadDetail(overlay = false) {
    if (!selectedLead) {
      return (
        <div className="grid min-h-72 place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Add or select a lead to view details.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <Info size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Basic Information
          </h4>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Name</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.company_name}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Phone</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.phone || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Email</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.email || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Source</span>
              <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{selectedSource?.name || selectedLead.source || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Assigned To</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{users.find(u => u.id === selectedLead.assigned_user_id)?.name || selectedLead.assigned_user_id || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Address</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.address || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <Flag size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Lead Status
          </h4>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Stage</span>
              <span className="inline-block rounded bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
                {selectedStage?.name || selectedLead.status || "N/A"}
              </span>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Priority</span>
              <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{selectedLead.priority || "medium"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Interest Level</span>
              <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{selectedLead.intent || selectedLead.tags?.[0] || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Budget</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.budget_max ? \`BDT \${selectedLead.budget_max}\` : ((selectedLead.industry_data as any)?.budget || "N/A")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <Calendar size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Follow-up
          </h4>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Last Contacted</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.updated_at ? formatDate(selectedLead.updated_at) : "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Next Follow-up</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                 {activities.find(a => a.due_at)?.due_at ? formatDate(activities.find(a => a.due_at)!.due_at!) : "N/A"}
              </p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Converted</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.converted_customer_id ? "Yes" : "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Lost</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.status === "lost" ? "Yes" : "N/A"}</p>
            </div>
            <div className="col-span-2">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Remarks</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.raw_note || "Nothing"}</p>
            </div>
            <div className="col-span-3">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Lost Reason</span>
              <p className="text-sm font-semibold text-rose-500">N/A</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
`.split('\n');

    lines.splice(renderLeadStart, (protectedPageStart - 1) - renderLeadStart, ...newRenderLead);
}

// For modal header:
const headerIndex = lines.findIndex(l => l.includes('{/* Header with sticky close button */}'));
if (headerIndex !== -1) {
  lines[headerIndex + 2] = `                 <div>
                   <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                     <Smartphone size={16} /> Lead Details - {selectedLead.id.substring(0, 8).toUpperCase()}
                   </h3>
                   <p className="mt-1 text-[10px] text-slate-500">Created by {users.find(u => u.id === selectedLead.assigned_user_id)?.name || "Super Admin"} | {formatDate(selectedLead.created_at)}</p>
                 </div>`;
}

// For Edit modal append:
const editModalIndex = lines.findIndex(l => l.includes('{budgetModalLeadId && (() => {'));
if (editModalIndex !== -1) {
   const editModal = `      {editModalLeadId && (() => {
        const leadToEdit = leads.find(l => l.id === editModalLeadId);
        if (!leadToEdit) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900 p-6 animate-fade-up">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Lead</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{leadToEdit.company_name}</p>
                </div>
                <button onClick={() => setEditModalLeadId(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
              </div>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const stageId = String(form.get("lead_stage_id") || "");
                  void updateLead(leadToEdit.id, {
                    company_name: String(form.get("company_name") || leadToEdit.company_name),
                    contact_person: String(form.get("contact_person") || "") || null,
                    phone: String(form.get("phone") || "") || null,
                    email: String(form.get("email") || "") || null,
                    priority: String(form.get("priority") || "medium"),
                    lead_stage_id: stageId || null,
                    lead_area_id: String(form.get("lead_area_id") || "") || null,
                    lead_profession_id: String(form.get("lead_profession_id") || "") || null,
                    assigned_user_id: String(form.get("assigned_user_id") || "") || null,
                    tags: editTags,
                    status: configs.stages.find((stage) => stage.id === stageId)?.name.toLowerCase().replace(/\\s+/g, "_") || leadToEdit.status,
                  });
                  setEditModalLeadId(null);
                }}
              >
                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Company Name</span>
                  <input name="company_name" defaultValue={leadToEdit.company_name} className="h-10 w-full rounded-xl border border-slate-200 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </label>
                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Contact Person</span>
                  <input name="contact_person" defaultValue={leadToEdit.contact_person ?? ""} className="h-10 w-full rounded-xl border border-slate-200 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </label>
                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Phone</span>
                  <input name="phone" defaultValue={leadToEdit.phone ?? ""} className="h-10 w-full rounded-xl border border-slate-200 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </label>
                <label className="block">
                  <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Email</span>
                  <input name="email" defaultValue={leadToEdit.email ?? ""} className="h-10 w-full rounded-xl border border-slate-200 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </label>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button type="button" onClick={() => setEditModalLeadId(null)} className="h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={loading} className="h-10 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-500">{loading ? "Saving..." : "Save Changes"}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}`.split('\n');
   lines.splice(editModalIndex, 0, ...editModal);
}

fs.writeFileSync('app/leads/page.tsx', lines.join('\n'));
