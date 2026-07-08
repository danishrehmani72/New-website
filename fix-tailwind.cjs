const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix the bad tailwind classes
  content = content.replace(/border-blue-500\/30\/(\d+)/g, 'border-blue-500/$1');
  content = content.replace(/bg-blue-600\/(\d+)/g, 'bg-blue-600/$1');
  content = content.replace(/text-blue-400\/(\d+)/g, 'text-blue-400/$1');
  
  fs.writeFileSync(file, content);
});

console.log("Fixed tailwind!");
