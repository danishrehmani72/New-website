const fs = require('fs');
let faq = fs.readFileSync('src/components/FaqSection.tsx', 'utf8');

const regex = /\{\s*question:\s*'How do I contact customer support 24\/7\?',[\s\S]*?\}\s*\]/;
faq = faq.replace(regex, ']');
fs.writeFileSync('src/components/FaqSection.tsx', faq);
