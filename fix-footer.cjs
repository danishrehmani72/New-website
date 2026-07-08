const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the contact block entirely
app = app.replace(/<div className="space-y-3">\s*<h4 className="text-\[11px\] font-black uppercase tracking-\[0\.2em\] text-\[\#10B981\]">Contact<\/h4>\s*<div className="flex flex-col gap-2 text-xs font-semibold">\s*<a href="mailto:support@apexcapital.test" className="text-zinc-300 hover:text-\[\#10B981\] transition-all flex items-center gap-1 bg-transparent border-0">\s*✉️ support@apexcapital\.test\s*<\/a>\s*<a href="https:\/\/t\.me\/moneymindspace" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-sky-400 transition-all flex items-center gap-1 bg-transparent border-0">\s*✈️ Telegram Official Helpline\s*<\/a>\s*<\/div>\s*<\/div>/g, `<div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#10B981]">Community</h4>
                    <div className="flex flex-col gap-2 text-xs font-semibold">
                      <a href="https://t.me/apexcapital_official" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-sky-400 transition-all flex items-center gap-1 bg-transparent border-0">
                        ✈️ Official Channel
                      </a>
                    </div>
                  </div>`);

// Remove "Contact Information" modal trigger
app = app.replace(/<button onClick=\{[^}]+\} className="text-left text-zinc-300 hover:text-blue-400 transition-all bg-transparent border-0 cursor-pointer outline-none">\s*Contact Information\s*<\/button>/g, '');

fs.writeFileSync('src/App.tsx', app);
