const fs = require('fs');
let content = fs.readFileSync('src/components/DashboardCard.tsx', 'utf8');

content = content.replace(/💎 Moneymindspace.online Official/g, 'Official Community');
content = content.replace(/Become part of our professional community to receive secure insights and daily updates regarding <strong className="text-blue-400 hover:underline cursor-pointer">Moneymindspace.online<\/strong> performance\./g, 'Join our official community for daily market insights and platform updates.');
content = content.replace(/Protected by Moneymindspace.online/g, 'Secure Communication Channel');
content = content.replace(/Our official customer care desk and compliance department verify transactions and support members around the clock\. Connect with us via our official channel <strong className="text-sky-400">@MoneyMindSpaceSupport<\/strong> for updates, or email <strong className="text-blue-400">support@moneymindspace\.online<\/strong> for direct security and ledger assistance\./g, 'Our support team is available 24/7 to assist with your account. Connect with us via Telegram or email for assistance.');
content = content.replace(/Customize your identity in the MoneyMind Space\. Update your public display name and select an avatar representative of your profile status\./g, 'Manage your profile identity. Update your display name and avatar.');
content = content.replace(/MoneyMind Space Gold Premium Logo/g, 'MoneyMind Space Logo');

fs.writeFileSync('src/components/DashboardCard.tsx', content);

let regContent = fs.readFileSync('src/components/RegistrationCard.tsx', 'utf8');
regContent = regContent.replace(/MoneyMind Space Gold Premium Logo/g, 'MoneyMind Space Logo');
regContent = regContent.replace(/Join our public channel at <a href="https:\/\/t\.me\/moneymindonlineearningspace" target="_blank" rel="noopener noreferrer" className="text-\[\#24A1DE\] font-extrabold hover:underline">t\.me\/moneymindonlineearningspace<\/a> representing <span className="text-blue-400 font-semibold">Moneymindspace.online<\/span> today! Exchange payment receipts and claim staking updates\./g, 'Join our official community channel for market insights, announcements, and support.');
regContent = regContent.replace(/Have persistent queries, setup issues, or login failures\? Email our security team directly at <a href="mailto:support@moneymindspace\.online" className="text-blue-400 font-extrabold hover:underline">support@moneymindspace\.online<\/a> for priority assistance\./g, 'Need help? Contact our support team directly for assistance.');
regContent = regContent.replace(/Did you register before the PIN update, or forgot your Recovery PIN\/Code\? Please reach out to our official help center at <span className="text-blue-400 font-semibold text-xs leading-none">support@moneymindspace.online<\/span>\. Our compliance and support team will verify your balance logs and securely reset your credentials\./g, 'If you forgot your PIN or need help recovering your account, please contact support for verification and reset assistance.');

fs.writeFileSync('src/components/RegistrationCard.tsx', regContent);

console.log("Updated Dashboard/Registration!");
