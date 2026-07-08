const fs = require('fs');

let content = fs.readFileSync('src/components/PlanMatrix.tsx', 'utf8');

content = content.replace(/const PLANS = \[\s*\{ id: 'bronze'[\s\S]*?\}\,\s*\]\;/m, `const PLANS = [
  { id: 'bronze', name: 'Starter Portfolio', min: 100, max: 999.99, targetPercent: 108, color: 'text-emerald-500', border: 'border-emerald-500/30' },
  { id: 'silver', name: 'Growth Portfolio', min: 1000, max: 4999.99, targetPercent: 112, color: 'text-indigo-400', border: 'border-indigo-400/30' },
  { id: 'gold', name: 'Pro Portfolio', min: 5000, max: 24999.99, targetPercent: 118, color: 'text-purple-400', border: 'border-purple-400/50' },
  { id: 'diamond', name: 'Elite Portfolio', min: 25000, max: Infinity, targetPercent: 124, color: 'text-blue-400', border: 'border-blue-500/50' },
];`);

// Fix wording in PlanMatrix.tsx
content = content.replace(/Target Return: /g, 'Estimated Yield: ');
content = content.replace(/Target Return of /g, 'Estimated Yield of ');

fs.writeFileSync('src/components/PlanMatrix.tsx', content);

console.log("Updated PlanMatrix!");
