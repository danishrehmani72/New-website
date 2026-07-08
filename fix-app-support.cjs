const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Replace "Please contact support."
app = app.replace(/Please contact support\./g, '');

// The "Contact Live Support Desk 💬" button
// It's probably in a floating button or similar. Let's replace the whole onClick or the text.
app = app.replace(/Contact Live Support Desk 💬/g, 'Official Announcements 📢');
app = app.replace(/https:\/\/t\.me\/ApexCapitalSupport/g, 'https://t.me/apexcapital_official');

app = app.replace(/24\/7 Support/g, 'Updates');
app = app.replace(/Active Support/g, 'Secure Infrastructure');
app = app.replace(/Support Contact/g, 'Contact');
app = app.replace(/Support Helplines Overview/g, 'Contact Information');
app = app.replace(/Contact Support Center/g, 'Contact Information');

fs.writeFileSync('src/App.tsx', app);
