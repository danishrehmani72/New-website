const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(/<div className="w-10 h-10 rounded-xl bg-\[\#10B981\]\/10 border border-\[\#10B981\]\/20 flex items-center justify-center text-xl text-\[\#10B981\]">\s*📞\s*<\/div>\s*<h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">Secure Infrastructure<\/h3>\s*<p className="text-\[11px\] text-zinc-400 leading-relaxed font-sans">\s*Help systems are fully functional\. Reach our administration instantly for fast, expert guidance on Telegram or email desk\.\s*<\/p>/g, `<div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-xl text-[#10B981]">
                      ⚡
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">Automated Processing</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      Our platform handles transactions and portfolio balancing with advanced institutional algorithms.
                    </p>`);

fs.writeFileSync('src/App.tsx', app);
