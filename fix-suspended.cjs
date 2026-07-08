const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(/suspicious ledger deposits\.\n\s*<\/div>/g, 'suspicious ledger deposits.\n          </p>\n        </div>');

fs.writeFileSync('src/App.tsx', app);
