const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Colors
  content = content.replace(/bg-\[\#0[Cc]0[Cc]0[Cc]\]/g, 'bg-slate-900');
  content = content.replace(/bg-\[\#080808\]/g, 'bg-slate-950');
  content = content.replace(/bg-black/g, 'bg-slate-950');
  content = content.replace(/text-\[\#D4AF37\]/g, 'text-blue-400');
  content = content.replace(/border-\[\#D4AF37\]/g, 'border-blue-500/30');
  content = content.replace(/bg-\[\#D4AF37\]/g, 'bg-blue-600');
  content = content.replace(/from-\[\#D4AF37\]/g, 'from-blue-600');
  content = content.replace(/to-amber-500/g, 'to-indigo-600');
  content = content.replace(/shadow-\[\#D4AF37\]/g, 'shadow-blue-500');
  content = content.replace(/ring-\[\#D4AF37\]/g, 'ring-blue-500');
  
  // Wording
  content = content.replace(/MoneyMind Space Gold Logo Icon/g, 'MoneyMind Space Logo');
  content = content.replace(/Premium Member/g, 'Verified Member');
  content = content.replace(/Anonymous VIP/g, 'User');
  content = content.replace(/Auditing ledger verification started\./g, 'Deposit submitted for review.');
  content = content.replace(/Cloud database connection busy\./g, 'Network busy.');
  content = content.replace(/Firestore Live/g, 'System Online');
  content = content.replace(/ADMIN CORE/g, 'Admin Panel');
  
  fs.writeFileSync(file, content);
});

console.log("Updated files!");
