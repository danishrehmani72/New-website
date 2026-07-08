const fs = require('fs');

const files = ['src/App.tsx', 'src/components/DashboardCard.tsx'];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace getPlanCapPercent implementation
  content = content.replace(/export function getPlanCapPercent\(planId: string, amount: number\): number \{[\s\S]*?\}\n/g, `export function getPlanCapPercent(planId: string, amount: number): number {
  const normId = (planId || '').toLowerCase().trim();
  if (normId === 'bronze') return 0.08; // Starter: 8% yield (108% total)
  if (normId === 'silver') return 0.12; // Growth: 12% yield (112% total)
  if (normId === 'gold') return 0.18;   // Pro: 18% yield (118% total)
  if (normId === 'diamond') return 0.24; // Elite: 24% yield (124% total)
  return 0.10; // Default 10%
}
`);
  fs.writeFileSync(file, content);
});

console.log("Updated getPlanCapPercent!");
