const fs = require('fs');

let admin = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
admin = admin.replace(/Contact support desk for correction\./g, 'Please try again.');
fs.writeFileSync('src/components/AdminPanel.tsx', admin);

let reg = fs.readFileSync('src/components/RegistrationCard.tsx', 'utf8');
reg = reg.replace(/market insights, announcements, and support\./g, 'market insights and announcements.');
fs.writeFileSync('src/components/RegistrationCard.tsx', reg);
