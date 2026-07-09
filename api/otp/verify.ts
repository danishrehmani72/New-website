import { VercelRequest, VercelResponse } from '@vercel/node';

async function verifyOtpInFirestore(email: string, code: string, type: string): Promise<boolean> {
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-remixearnhub-a807d10e-b26a-4c76-90b4-c26febef321c/documents:runQuery";
  try {
    const body = {
      structuredQuery: {
        from: [{ collectionId: "otps" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "email" },
                  op: "EQUAL",
                  value: { stringValue: email.toLowerCase().trim() }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "code" },
                  op: "EQUAL",
                  value: { stringValue: code.trim() }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "type" },
                  op: "EQUAL",
                  value: { stringValue: type }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "verified" },
                  op: "EQUAL",
                  value: { booleanValue: false }
                }
              }
            ]
          }
        },
        limit: 1
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.warn(`[OTP System] runQuery status: ${res.status}`);
      return false;
    }

    const data = await res.json();
    if (data && data.length > 0 && data[0].document) {
      const doc = data[0].document;
      const fields = doc.fields || {};
      const expiresAtStr = fields.expiresAt?.stringValue;
      if (expiresAtStr) {
        const expiresAt = new Date(expiresAtStr).getTime();
        const now = Date.now();
        if (now <= expiresAt) {
          const docName = doc.name; // full resource path
          await markOtpAsVerified(docName);
          return true;
        } else {
          console.log(`[OTP System] Code is expired for ${email}`);
        }
      }
    }
    return false;
  } catch (err) {
    console.error("[OTP System] Error verifying OTP via REST:", err);
    return false;
  }
}

async function markOtpAsVerified(docResourceName: string) {
  const url = `https://firestore.googleapis.com/v1/${docResourceName}?updateMask.fieldPaths=verified`;
  const body = {
    fields: {
      verified: { booleanValue: true }
    }
  };
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn(`[OTP System] Failed to patch verified status: ${res.status}`);
    }
  } catch (err) {
    console.error("[OTP System] Error patching OTP document:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, code, type } = req.body;
  if (!email || !code || !type) {
    return res.status(400).json({ error: "Email, Code and Type are required." });
  }

  const isValid = await verifyOtpInFirestore(email, code, type);
  if (isValid) {
    return res.json({ success: true, message: "OTP verified successfully! ✔" });
  } else {
    return res.status(400).json({ success: false, error: "Incorrect, used or expired verification code." });
  }
}
