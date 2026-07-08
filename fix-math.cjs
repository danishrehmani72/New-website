const fs = require('fs');

let content = fs.readFileSync('src/components/PlanMatrix.tsx', 'utf8');

// The targetPercent should just be the APY/Yield (e.g. 8, 12, 18, 24)
content = content.replace(/targetPercent: 108/g, 'targetPercent: 8');
content = content.replace(/targetPercent: 112/g, 'targetPercent: 12');
content = content.replace(/targetPercent: 118/g, 'targetPercent: 18');
content = content.replace(/targetPercent: 124/g, 'targetPercent: 24');

// Change "Estimated Yield: X%" to "Estimated APY: X%"
content = content.replace(/Estimated Yield: \{selectedPlan.targetPercent\}\%/g, 'Estimated APY: {selectedPlan.targetPercent}%');

// Change the matured return calculation to 1 + (targetPercent / 100)
content = content.replace(/planInfo\.targetPercent \/ 100/g, '1 + (planInfo.targetPercent / 100)');

fs.writeFileSync('src/components/PlanMatrix.tsx', content);
console.log("Fixed PlanMatrix math!");
