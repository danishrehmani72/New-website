const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace weird gradients
content = content.replace(/via-\[\#D4AF37\]/g, 'via-blue-400');
content = content.replace(/D4AF37/g, '3b82f6'); // blue-500 hex
content = content.replace(/💸 Earn Daily Online/g, 'Wealth Management Platform');
content = content.replace(/Join MoneyMind Space to claim yields, build automated income, and secure high-rate cryptographic earnings in Pakistan & globally\./g, 'Access algorithmic investment strategies and institutional-grade portfolio management tailored for long-term growth.');
content = content.replace(/Multi-Protocol Vault Live/g, 'Secure Infrastructure');
content = content.replace(/Start Earning/g, 'Open an Account');
content = content.replace(/from-\[\#10B981\] via-blue-400 to-\[\#10B981\]/g, 'from-blue-600 via-indigo-500 to-blue-600');
content = content.replace(/text-black font-black/g, 'text-white font-bold');
content = content.replace(/from-\[\#0F0F0F\] to-black border-2 border-\[\#10B981\]\/25/g, 'from-slate-950 to-slate-900 border border-white/10');
content = content.replace(/bg-gradient-to-br from-\[\#10B981\]\/10 via-blue-400\/5/g, 'bg-gradient-to-br from-blue-500/10 via-indigo-500/5');

fs.writeFileSync('src/App.tsx', content);

console.log("Updated Hero!");
