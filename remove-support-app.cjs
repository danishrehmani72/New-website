const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/import LiveChatBot from '\.\/components\/LiveChatBot';\n/g, '');
app = app.replace(/<LiveChatBot \/>\n/g, '');
fs.writeFileSync('src/App.tsx', app);

let faq = fs.readFileSync('src/components/FaqSection.tsx', 'utf8');
// Let's remove the question about customer support.
faq = faq.replace(/\{\s*question:\s*'How do I contact customer support 24\/7\?',[\s\S]*?\}\s*\],/, '],');
fs.writeFileSync('src/components/FaqSection.tsx', faq);
