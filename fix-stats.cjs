const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/Active Profiles on Ledger/g, 'Registered Users');
content = content.replace(/Active Yield Earners/g, 'Active Portfolios');
content = content.replace(/Total Secured Deposits/g, 'Total Deposits');
content = content.replace(/PKR & USDT Stake Capital/g, 'Platform Assets under Management');
content = content.replace(/Total Verified Withdrawals/g, 'Total Withdrawals');
content = content.replace(/Total Disbursed Funds/g, 'Processed Transactions');
content = content.replace(/Pending Requests Queue/g, 'Pending Transactions');
content = content.replace(/Audit Verification Queue/g, 'Currently Processing');

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed stats text!");
