const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/MoneyMind Space/gi, 'Apex Capital');
  content = content.replace(/moneymindspace\.com/gi, 'apexcapital.test');
  content = content.replace(/moneymindonlineearningspace/gi, 'apexcapital_official');
  content = content.replace(/MoneyMindSpaceSupport/gi, 'ApexCapitalSupport');
  content = content.replace(/moneymindspace\.online/gi, 'apexcapital.test');
  content = content.replace(/MoneyMind Governance Core/gi, 'Admin Governance Core');

  fs.writeFileSync(file, content);
});

console.log("Renamed company!");
