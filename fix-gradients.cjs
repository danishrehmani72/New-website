const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/bg-gradient-to-r from-blue-600 via-\[\#f3cb49\] to-\[\#D4AF37\]/g, 'bg-blue-600 hover:bg-blue-500');
  content = content.replace(/rgba\(212,175,55/g, 'rgba(59,130,246'); // 59,130,246 is blue-500
  content = content.replace(/via-\[\#f3cb49\]/g, 'via-blue-500');
  content = content.replace(/to-\[\#D4AF37\]/g, 'to-blue-400');
  content = content.replace(/from-\[\#f3cb49\]/g, 'from-blue-500');
  content = content.replace(/from-amber-500/g, 'from-blue-500');
  content = content.replace(/to-amber-500/g, 'to-blue-600');
  content = content.replace(/to-\[\#D4AF37\]/g, 'to-blue-400');
  content = content.replace(/bg-\[\#D4AF37\]/g, 'bg-blue-500');
  content = content.replace(/text-\[\#D4AF37\]/g, 'text-blue-500');
  content = content.replace(/border-\[\#D4AF37\]/g, 'border-blue-500/30');
  content = content.replace(/shadow-\[\#D4AF37\]/g, 'shadow-blue-500');
  content = content.replace(/ring-\[\#D4AF37\]/g, 'ring-blue-500');
  
  // Also clean up any accidental double prefixes we might have made
  content = content.replace(/border-blue-500\/30\/(\d+)/g, 'border-blue-500/$1');
  
  fs.writeFileSync(file, content);
});

console.log("Fixed gradients and shadows!");
