const fs = require('fs');

let content = fs.readFileSync('src/components/LiveChatBot.tsx', 'utf8');

content = content.replace(/🛡️ MoneyMind Governance Core live review ensures absolute financial security! Let us know if you need any other help./g, 'Our platform employs institutional-grade security measures. Let us know if you need any other help.');
content = content.replace(/5. MoneyMind automatic ledger verification system check karke balances direct update kar deta hai!/g, '5. Our automated systems securely process and verify deposits to reflect in your balance.');
content = content.replace(/\*\*MoneyMind Space Premium AI & Ledger Features:\*\* 🤖/g, '**Platform Features & Capabilities:**');
content = content.replace(/Shukriya hum se rabta karne ka! 🌟 MoneyMind Space high-yield staking aur referral networks me sab se secure aur fast service provide karta hai./g, 'Thank you for reaching out! We offer comprehensive wealth management and portfolio growth solutions.');
content = content.replace(/Asalam-o-Alaikum! 💰 Main aapka \*\*MindBuddy AI Companion\*\* hoon. Main real-time Roman Urdu, Urdu aur English me MoneyMind Space ke sawalat ke jawab de sakta hoon. Mujh se poochain: \\n- \*Paise kese kamaen\?\*\\n- \*AI features kon konsey hain\?\*\\n- \*Deposit aur withdrawal ka aasan tarika kya hai\?\*/g, 'Hello! I am your AI Support Assistant. I can help answer questions regarding your account in English, Urdu, and Roman Urdu. Ask me about:\\n- *Portfolio options*\\n- *Platform features*\\n- *Deposits and withdrawals*');
content = content.replace(/Live MoneyMind Support/g, 'Live Support');

fs.writeFileSync('src/components/LiveChatBot.tsx', content);

console.log("Updated ChatBot!");
