const fs = require('fs');
let code = fs.readFileSync('test.tsx', 'utf8');
let lines = code.split('\n');
lines.splice(647, 0, '    }');
for (let i=0; i<40; i++) {
  if (lines[i].includes('ChevronDown')) {
    lines[i] = '  ChevronDown, Briefcase, Edit';
    break;
  }
}
code = lines.join('\n');
code = code.replace(/placeholder="Select Stage"/g, 'placeholder="Lead Stage"');
code = code.replace(/placeholder="Select Priority"/g, 'placeholder="Lead Priority"');

const insertIndex = code.indexOf('{budgetModalLeadId && (() => {');
const selectedLeadBlock = `        {selectedLead ? (
          <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Lead detail"
              className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 animate-scale-in border border-white/20 dark:border-white/10"
            >
              {/* Header with sticky close button */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/20 px-6 py-4 backdrop-blur-xl dark:bg-white/5">
                 <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Lead Profile</h3>
                 <button 
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                 >
                  <X size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {renderLeadDetail(true)}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </section>

      `;
code = code.slice(0, insertIndex) + selectedLeadBlock + code.slice(insertIndex);
fs.writeFileSync('frontend/app/leads/page.tsx', code);
