const https = require('https');
const projectId = "ai-studio-a807d10e-b26a-4c76-90b4-c26febef321c";
const collection = "users";

const options = {
  hostname: 'firestore.googleapis.com',
  port: 443,
  path: `/v1/projects/${projectId}/databases/(default)/documents/${collection}`,
  method: 'GET'
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if(json.documents) {
        json.documents.forEach(doc => {
            const fields = doc.fields;
            if (fields && fields.userId && fields.userId.stringValue === 'danish125') {
                console.log('Found user:', JSON.stringify(fields, null, 2));
            }
        });
    } else {
        console.log("No documents or error:", json);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
