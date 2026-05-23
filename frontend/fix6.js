const fs = require('fs');
let lines = fs.readFileSync('app/leads/page.tsx', 'utf8').split(/\r?\n/);

const actionStartIndex = lines.findIndex((l, i) => l.includes('<td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>') && lines[i+1].includes('<div className="flex items-center justify-end gap-1.5 text-slate-400">'));

if (actionStartIndex !== -1) {
  const newAction = `                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 text-slate-400">
                            <button onClick={() => { openLead(lead.id); }} className="rounded p-1.5 hover:bg-white/60 hover:text-brand-500 dark:hover:bg-white/10">
                              <Eye size={16} />
                            </button>
                            {currentUser?.role === "admin" && (
                              <button onClick={() => void deleteLead(lead.id)} className="rounded p-1.5 hover:bg-rose-500/10 hover:text-rose-500">
                                <Trash2 size={16} />
                              </button>
                            )}
                            <div className="relative">
                              <button onClick={(e) => { e.stopPropagation(); setActionDropdownId(actionDropdownId === lead.id ? null : lead.id) }} className="rounded p-1.5 hover:bg-white/60 hover:text-emerald-500 dark:hover:bg-white/10">
                                <Edit2 size={16} />
                              </button>
                              {actionDropdownId === lead.id && (
                                <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-white shadow-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700 z-50 overflow-hidden text-left" onMouseLeave={() => setActionDropdownId(null)}>
                                  <button onClick={(e) => { e.stopPropagation(); setEditModalLeadId(lead.id); setActionDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 flex items-center gap-2"><Edit2 size={14} /> Edit Lead</button>
                                  {currentUser?.role === "admin" && (
                                    <button onClick={(e) => { e.stopPropagation(); setBudgetModalLeadId(lead.id); setActionDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"><CheckCircle2 size={14} /> Convert</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>`.split('\n');

   lines.splice(actionStartIndex, 12, ...newAction);
}

const filterContainerIndex = lines.findIndex(l => l.includes('<div className={`flex w-full flex-wrap items-center gap-2 sm:w-auto ${viewMode === \'board\' ? \'hidden\' : \'\'}`}>'));
if (filterContainerIndex !== -1) {
    lines[filterContainerIndex] = lines[filterContainerIndex].replace('sm:w-auto', 'flex-1');
}

const filterButtonIndex = lines.findIndex(l => l.includes('<button type="button" onClick={() => void loadLeads()} className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500">'));
if (filterButtonIndex !== -1) {
    lines[filterButtonIndex] = lines[filterButtonIndex].replace('hover:bg-brand-500"', 'hover:bg-brand-500 ml-auto"');
}

fs.writeFileSync('app/leads/page.tsx', lines.join('\n'));
