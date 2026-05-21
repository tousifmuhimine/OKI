const fs = require('fs');
let code = fs.readFileSync('frontend/app/dashboard/page.tsx', 'utf8');
let lines = code.split('\n');

// 1. Add new state variables
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [userRole, setUserRole]')) {
    lines.splice(i + 1, 0, 
      '  const [userId, setUserId] = useState<string | null>(null);',
      '  const [bucketTab, setBucketTab] = useState<"Today" | "This Week" | "This Month">("Today");',
      '  const [bucketLeads, setBucketLeads] = useState<any[]>([]);',
      '  const [bucketTasks, setBucketTasks] = useState<any[]>([]);',
      '  const [loadingBucket, setLoadingBucket] = useState(false);'
    );
    break;
  }
}

// 2. Set userId
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('setUserRole(String(role));')) {
    lines.splice(i + 1, 0, '        setUserId(data.user.id);');
    break;
  }
}

// 3. Add useEffect for bucket loading
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('getSupabaseClient().auth.getUser()')) {
    const useEffectStr = `
  useEffect(() => {
    if (!userId || userRole === "admin") return;
    let alive = true;
    async function loadBucket() {
      setLoadingBucket(true);
      try {
        const now = new Date();
        let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (bucketTab === "This Week") {
          start.setDate(now.getDate() - now.getDay());
        } else if (bucketTab === "This Month") {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const sd = start.toISOString();
        
        const [leadsRes, tasksRes] = await Promise.all([
          apiRequest("/leads?quick_filter=assigned_to_me&start_date=" + sd + "&sort=desc&limit=20"),
          apiRequest("/tasks?assigned_user_id=" + userId + "&start_date=" + sd + "&limit=20")
        ]);
        if (!alive) return;
        setBucketLeads((leadsRes as any).data || []);
        setBucketTasks((tasksRes as any).data || []);
      } catch (err) {
        console.error("Failed to load buckets", err);
      } finally {
        if (alive) setLoadingBucket(false);
      }
    }
    loadBucket();
    return () => { alive = false; };
  }, [bucketTab, userId, userRole]);
`;
    lines.splice(i - 1, 0, useEffectStr); // insert before the getSupabaseClient effect
    break;
  }
}

code = lines.join('\n');

const oldBoxStr = `          {showAssignedBuckets && (
            <BCard className="lg:col-span-5 lg:row-span-2" delay="70ms">
              <CardHead
                title={<><CheckSquare size={14} className="text-brand-500" /> My assigned leads</>}
                sub="Newly assigned leads by created date"
              />
              <div className="grid gap-3 px-5 py-4">
                <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/30 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Daily</span>
                  <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold text-brand-600 dark:text-brand-300">{data?.assigned_leads_daily ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/30 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Weekly</span>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">{data?.assigned_leads_weekly ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/30 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly</span>
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-300">{data?.assigned_leads_monthly ?? 0}</span>
                </div>
              </div>
            </BCard>
          )}`;

const newBoxStr = `          {showAssignedBuckets && (
            <BCard className="lg:col-span-5 lg:row-span-2 flex flex-col" delay="70ms">
              <div className="border-b border-white/10 bg-white/10 px-5 py-4 dark:bg-white/5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                  <CheckSquare size={16} className="text-brand-500" /> My Bucket
                </div>
                <div className="flex gap-2">
                  {(["Today", "This Week", "This Month"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setBucketTab(tab)}
                      className={\`rounded-full px-3 py-1 text-xs font-bold transition \${bucketTab === tab ? 'bg-brand-500 text-white shadow-glow' : 'bg-slate-200/50 text-slate-600 hover:bg-slate-300/50 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'}\`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                {loadingBucket ? (
                  <div className="flex h-32 items-center justify-center">
                    <RefreshCw className="animate-spin text-brand-500" />
                  </div>
                ) : (
                  <>
                    {bucketLeads.length === 0 && bucketTasks.length === 0 ? (
                      <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-slate-500">
                        <CheckSquare size={24} className="mb-2 opacity-20" />
                        No leads or tasks assigned {bucketTab.toLowerCase()}.
                      </div>
                    ) : (
                      <>
                        {bucketLeads.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leads ({bucketLeads.length})</h4>
                            {bucketLeads.map((l: any) => (
                              <div key={l.id} className="rounded-xl border border-white/20 bg-white/40 p-3 dark:border-white/10 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 transition">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{l.company_name || l.contact_person || 'Unnamed Lead'}</div>
                                <div className="text-xs text-slate-500 mt-1 flex justify-between">
                                  <span>{l.status}</span>
                                  <span>{new Date(l.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {bucketTasks.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2">Tasks ({bucketTasks.length})</h4>
                            {bucketTasks.map((t: any) => (
                              <div key={t.id} className="rounded-xl border border-white/20 bg-white/40 p-3 dark:border-white/10 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 transition">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{t.title}</div>
                                <div className="text-xs text-slate-500 mt-1 flex justify-between">
                                  <span className={\`capitalize \${t.priority === 'high' ? 'text-rose-500' : ''}\`}>{t.priority}</span>
                                  <span>{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </BCard>
          )}`;

code = code.replace(oldBoxStr, newBoxStr);
fs.writeFileSync('frontend/app/dashboard/page.tsx', code);
