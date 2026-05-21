const fs = require('fs');
let code = fs.readFileSync('frontend/app/leads/page.tsx', 'utf8');
let lines = code.split('\n');

// 1. Add state variables
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [shareLeadId, setShareLeadId]')) {
    lines.splice(i + 1, 0,
      '  const [shareMode, setShareMode] = useState<"public" | "restricted">("restricted");',
      '  const [shareEmails, setShareEmails] = useState("");',
      '  const [shareLink, setShareLink] = useState<string | null>(null);',
      '  const [shareError, setShareError] = useState<string | null>(null);',
      '  const [sharing, setSharing] = useState(false);'
    );
    break;
  }
}

// 2. Add handleShareLead function
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function openLead(leadId: string)')) {
    const handleShareLead = `  async function handleShareLead(e: React.FormEvent) {
    e.preventDefault();
    if (!shareLeadId) return;
    setSharing(true);
    setShareError(null);
    try {
      const payload: any = { mode: shareMode };
      if (shareMode === "restricted") {
        const emails = shareEmails.split(",").map(em => em.trim()).filter(Boolean);
        if (emails.length === 0) throw new Error("Please enter at least one email address");
        payload.allowed_emails = emails;
      }
      
      const res = await apiRequest(\`/leads/\${shareLeadId}/share-links\`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setShareLink((res as any).share_url);
    } catch (err: any) {
      setShareError(err.message);
    } finally {
      setSharing(false);
    }
  }

`;
    lines.splice(i, 0, handleShareLead);
    break;
  }
}

code = lines.join('\n');

// 3. Add the modal before the final </ProtectedPage>
const modalCode = `      {shareLeadId && (() => {
        const lead = leads.find(l => l.id === shareLeadId);
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-scale-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Share Lead</h3>
                <button onClick={() => { setShareLeadId(null); setShareLink(null); }} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-5">Share <strong>{lead?.company_name || lead?.contact_person}</strong> with external partners or users.</p>
              
              {shareLink ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 text-center">
                    <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Share link generated successfully!</p>
                  </div>
                  <div className="flex gap-2 items-center rounded-xl bg-white/50 border border-slate-200 dark:bg-black/30 dark:border-white/10 p-2">
                    <input readOnly value={shareLink} className="flex-1 bg-transparent text-sm px-2 outline-none text-slate-600 dark:text-slate-300" />
                    <button onClick={() => navigator.clipboard.writeText(shareLink)} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white shadow-glow hover:bg-brand-400">Copy</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleShareLead} className="space-y-4">
                  {shareError && <div className="text-xs text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{shareError}</div>}
                  
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button type="button" onClick={() => setShareMode("restricted")} className={\`rounded-lg py-2 text-xs font-bold transition \${shareMode === "restricted" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700"}\`}>Specific Emails</button>
                    <button type="button" onClick={() => setShareMode("public")} className={\`rounded-lg py-2 text-xs font-bold transition \${shareMode === "public" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700"}\`}>Anyone with link</button>
                  </div>

                  {shareMode === "restricted" && (
                    <label className="block">
                      <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Allowed Emails (comma separated)</span>
                      <input 
                        value={shareEmails} 
                        onChange={e => setShareEmails(e.target.value)} 
                        placeholder="partner@example.com, client@example.com"
                        className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                      />
                    </label>
                  )}

                  <div className="pt-2">
                    <button type="submit" disabled={sharing} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60">
                      {sharing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                      Generate Link
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

    </ProtectedPage>`;

code = code.replace('    </ProtectedPage>', modalCode);
fs.writeFileSync('frontend/app/leads/page.tsx', code);
