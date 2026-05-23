const fs = require('fs');
let content = fs.readFileSync('app/leads/page.tsx', 'utf8');

// 1. Add Icons
content = content.replace(
  'ChevronDown, Briefcase, Edit\n} from "lucide-react";',
  'ChevronDown, Briefcase, Edit, Smartphone, Flag, Calendar, Info, MoreVertical\n} from "lucide-react";'
);

// 2. Add States
content = content.replace(
  '  const [editTagInput, setEditTagInput] = useState("");',
  `  const [editTagInput, setEditTagInput] = useState("");
  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);
  const [editModalLeadId, setEditModalLeadId] = useState<string | null>(null);`
);

// 3. Add Effect
content = content.replace(
  '  useEffect(() => {\n    if (!selectedLead) return;\n    setAiInstructions(selectedLead.ai_instructions ?? "");\n    setEditTags(selectedLead.tags ?? []);\n    if (leadSidebarTab === "activity") {\n      void loadActivities(selectedLead.id);\n    }\n  }, [selectedLead?.id, selectedLead?.ai_instructions, leadSidebarTab]);',
  `  useEffect(() => {
    if (!selectedLead) return;
    setAiInstructions(selectedLead.ai_instructions ?? "");
    setEditTags(selectedLead.tags ?? []);
    if (leadSidebarTab === "activity") {
      void loadActivities(selectedLead.id);
    }
  }, [selectedLead?.id, selectedLead?.ai_instructions, leadSidebarTab]);

  useEffect(() => {
    if (editModalLeadId) {
      const l = leads.find((l) => l.id === editModalLeadId);
      setEditTags(l?.tags ?? []);
    }
  }, [editModalLeadId, leads]);`
);

// 4. Update Action column
const oldActionCol = `<td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 text-slate-400">
                            <button onClick={() => { openLead(lead.id); }} className="rounded p-1.5 hover:bg-white/60 hover:text-brand-500 dark:hover:bg-white/10">
                              <Eye size={16} />
                            </button>
                            {currentUser?.role === "admin" && (
                              <button onClick={() => void deleteLead(lead.id)} className="rounded p-1.5 hover:bg-rose-500/10 hover:text-rose-500">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>`;

const newActionCol = `<td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
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
                        </td>`;
content = content.replace(oldActionCol, newActionCol);

fs.writeFileSync('app/leads/page.tsx', content);
