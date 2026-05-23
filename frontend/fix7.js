const fs = require('fs');

let page = fs.readFileSync('app/leads/page.tsx', 'utf8');
const oldPage = fs.readFileSync('app/leads/page_old2.tsx', 'utf8');

// 1. Revert the filter gap:
page = page.replace(
  '<div className={`flex w-full flex-wrap items-center gap-2 flex-1 ${viewMode === \'board\' ? \'hidden\' : \'\'}`}>',
  '<div className={`flex w-full flex-wrap items-center gap-2 sm:w-auto ${viewMode === \'board\' ? \'hidden\' : \'\'}`}>'
);
page = page.replace(
  'onClick={() => void loadLeads()} className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500 ml-auto"',
  'onClick={() => void loadLeads()} className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500"'
);

// 2. Extract the old form
const oldLines = oldPage.split(/\r?\n/);
let oldFormLines = [];
let capturing = false;
for (let i = 0; i < oldLines.length; i++) {
  if (oldLines[i].includes('              <form') && oldLines[i+1].includes('                className="space-y-3"')) {
    capturing = true;
  }
  if (capturing) {
    oldFormLines.push(oldLines[i]);
    if (oldLines[i].includes('              </form>')) {
      break;
    }
  }
}

const oldFormCode = oldFormLines.join('\n');

// 3. Remove ALL my injected editModalLeadId modals
while (page.includes('{editModalLeadId && (() => {')) {
  const start = page.indexOf('{editModalLeadId && (() => {');
  const endMarker = '      })()}';
  const end = page.indexOf(endMarker, start);
  if (end !== -1) {
    page = page.substring(0, start) + page.substring(end + endMarker.length);
  } else {
    break; // safety
  }
}
// Clean up extra blank lines
page = page.replace(/\n\s*\n\s*\n/g, '\n\n');

// 4. Inject the new modal with the old form
const newModal = `
      {editModalLeadId && (() => {
        const selectedLead = leads.find(l => l.id === editModalLeadId);
        if (!selectedLead) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900 animate-fade-up">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Lead</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{selectedLead.company_name}</p>
                </div>
                <button onClick={() => setEditModalLeadId(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6">
${oldFormCode.split('\n').map(l => '  ' + l).join('\n')}
              </div>
            </div>
          </div>
        );
      })()}
`;

// Insert it right before {budgetModalLeadId
const insertIndex = page.indexOf('{budgetModalLeadId && (() => {');
if (insertIndex !== -1) {
  page = page.substring(0, insertIndex) + newModal + page.substring(insertIndex);
}

// 5. One more thing: the old form doesn't close the modal on submit! I need to add that.
page = page.replace(
  `                    status: configs.stages.find((stage) => stage.id === stageId)?.name.toLowerCase().replace(/\\s+/g, "_") || selectedLead.status,\n                  });\n                }}`,
  `                    status: configs.stages.find((stage) => stage.id === stageId)?.name.toLowerCase().replace(/\\s+/g, "_") || selectedLead.status,\n                  });\n                  setEditModalLeadId(null);\n                }}`
);
// Also the "Cancel" button needs to be added, but maybe it's fine since there's a close button on top. But I should add a cancel button.
const oldSubmitArea = `                <div className="flex gap-2">
                  <button type="submit" disabled={savingId === selectedLead.id} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60">
                    Save Changes
                  </button>
                  <button type="button" onClick={() => deleteLead(selectedLead.id)} className="h-11 rounded-xl bg-rose-500/10 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400">
                    Delete
                  </button>
                </div>`;
const newSubmitArea = `                <div className="flex gap-2 mt-6">
                  <button type="button" onClick={() => setEditModalLeadId(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingId === selectedLead.id} className="flex-1 h-11 rounded-xl bg-brand-600 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60">
                    Save Changes
                  </button>
                </div>`;
page = page.replace(oldSubmitArea, newSubmitArea);

fs.writeFileSync('app/leads/page.tsx', page);
