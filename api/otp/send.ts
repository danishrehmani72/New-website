import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from "nodemailer";

async function checkOtpRateLimit(email: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-remixearnhub-a807d10e-b26a-4c76-90b4-c26febef321c/documents:runQuery";
  try {
    const body = {
      structuredQuery: {
        from: [{ collectionId: "otps" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "email" },
            op: "EQUAL",
            value: { stringValue: email.toLowerCase().trim() }
          }
        },
        limit: 5
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      return { allowed: true };
    }

    const data = await res.json();
    let latestTime = 0;

    if (data && Array.isArray(data)) {
      for (const item of data) {
        if (item.document) {
          const fields = item.document.fields || {};
          const createdAtStr = fields.createdAt?.stringValue;
          if (createdAtStr) {
            const time = new Date(createdAtStr).getTime();
            if (time > latestTime) {
              latestTime = time;
            }
          }
        }
      }
    }

    if (latestTime > 0) {
      const now = Date.now();
      const diffSeconds = Math.floor((now - latestTime) / 1000);
      if (diffSeconds < 60) {
        return { allowed: false, waitSeconds: 60 - diffSeconds };
      }
    }
    return { allowed: true };
  } catch (err) {
    console.error("[OTP System] Rate limit check error:", err);
    return { allowed: true };
  }
}

async function saveOtpToFirestore(email: string, code: string, type: string) {
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-remixearnhub-a807d10e-b26a-4c76-90b4-c26febef321c/documents/otps";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes expiry

  const body = {
    fields: {
      email: { stringValue: email.toLowerCase().trim() },
      code: { stringValue: code.trim() },
      type: { stringValue: type },
      createdAt: { stringValue: now.toISOString() },
      expiresAt: { stringValue: expiresAt.toISOString() },
      verified: { booleanValue: false }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[OTP System] Failed to write OTP: status ${res.status}, ${text}`);
    }
  } catch (err) {
    console.error("[OTP System] Error saving OTP:", err);
  }
}

async function fetchGlobalSettings() {
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-remixearnhub-a807d10e-b26a-4c76-90b4-c26febef321c/documents/users/global_settings";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Firestore REST] Failed to fetch settings: status ${res.status}`);
      return null;
    }
    const data = await res.json();
    const fields = data.fields || {};
    
    const getVal = (field: any) => {
      if (!field) return undefined;
      if (field.integerValue !== undefined) return parseInt(field.integerValue);
      if (field.doubleValue !== undefined) return parseFloat(field.doubleValue);
      if (field.stringValue !== undefined) return field.stringValue;
      if (field.booleanValue !== undefined) return field.booleanValue;
      return undefined;
    };

    return {
      smtpHost: getVal(fields.smtpHost),
      smtpPort: getVal(fields.smtpPort),
      smtpUser: getVal(fields.smtpUser),
      smtpPass: getVal(fields.smtpPass),
      senderName: getVal(fields.senderName),
      adminEmail: getVal(fields.adminEmail)
    };
  } catch (err) {
    console.error("[Firestore REST] Error retrieving global_settings:", err);
    return null;
  }
}

async function logEmailDelivery(to: string, subject: string, status: "success" | "failed", errorMsg?: string) {
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-remixearnhub-a807d10e-b26a-4c76-90b4-c26febef321c/documents/email_logs";
  const body = {
    fields: {
      to: { stringValue: to },
      subject: { stringValue: subject },
      status: { stringValue: status },
      timestamp: { stringValue: new Date().toISOString() },
      error: { stringValue: errorMsg || "" }
    }
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn(`[Firestore REST] Failed to write email log: status ${res.status}`);
    }
  } catch (err) {
    console.error("[Firestore REST] Error writing email log:", err);
  }
}

async function sendGeneralEmail({
  to,
  subject,
  html,
  text
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const targetLower = to.toLowerCase().trim();
  if (
    targetLower.includes("no-email") || 
    targetLower.endsWith("@wealthhub.com") || 
    targetLower.endsWith("@moneymindspace.com") || 
    !targetLower.includes("@")
  ) {
    await logEmailDelivery(to, `${subject} (Simulated Test Account)`, "success", "Filtered placeholder email");
    return { success: true, provider: "demo" };
  }

  const settings = await fetchGlobalSettings();
  if (settings && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost.trim(),
        port: Number(settings.smtpPort) || 465,
        secure: Number(settings.smtpPort) === 465 || !settings.smtpPort,
        auth: {
          user: settings.smtpUser.trim(),
          pass: settings.smtpPass.trim(),
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const mailOptions = {
        from: `"${settings.senderName || 'MoneyMind Space'}" <${settings.smtpUser.trim()}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      await logEmailDelivery(to, subject, "success");
      return { success: true, provider: "smtp", id: info.messageId };
    } catch (smtpErr: any) {
      console.error(`[SMTP Fail] Delivery to ${to} failed:`, smtpErr);
    }
  }

  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const senderEmail = "support@moneymindspace.online";

  if (resendApiKey) {
    try {
      let response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `MoneyMind Space <${senderEmail}>`,
          to: [to],
          subject,
          html,
          text
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: `MoneyMind Space <onboarding@resend.dev>`,
            to: [to],
            subject,
            html,
            text
          })
        });

        if (!response.ok) {
          const finalErrorText = await response.text();
          throw new Error(`Resend Primary & Fallback failed. Final API Error: ${finalErrorText}`);
        }
      }

      const resData = await response.json();
      await logEmailDelivery(to, subject, "success");
      return { success: true, provider: "resend", id: resData.id };
    } catch (err: any) {
      console.error(`[Resend Fail] Delivery failed:`, err);
      const errMsg = err.message || "Resend API transmission error";
      await logEmailDelivery(to, subject, "failed", errMsg);
      return { success: false, provider: "resend", error: errMsg };
    }
  } else {
    await logEmailDelivery(to, `${subject} (Simulated Demo)`, "success", "Simulated delivery (No SMTP or RESEND_API_KEY)");
    return { success: true, provider: "demo" };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, type } = req.body;
  if (!email || !type) {
    return res.status(400).json({ error: "Email and type (signup | reset) are required." });
  }

  const cleanEmail = email.toLowerCase().trim();

  const rateLimit = await checkOtpRateLimit(cleanEmail);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: `Please wait ${rateLimit.waitSeconds} seconds before requesting another code. 🛡️` 
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await saveOtpToFirestore(cleanEmail, code, type);

  let subject = "";
  let html = "";
  let text = "";

  if (type === "signup") {
    subject = `[MoneyMind Space] Verify your email address`;
    text = `Hello,\n\nYour 6-digit Email Verification OTP is: ${code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nMoneyMind Space Team`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #10B981; font-weight: 800; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">MoneyMind Space</h2>
          <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 2px;">Email Verification System</span>
        </div>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Hello,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Thank you for starting your registration on MoneyMind Space. To confirm your email address ownership, please use the 6-digit security code below:</p>
        <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #111827; font-family: monospace;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">⚠️ <strong>Note:</strong> This verification code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Best regards,<br><strong>MoneyMind Space Team</strong></p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 30px;">
          This is an automated transmission. Please do not reply directly.
        </p>
      </div>
    `;
  } else if (type === "reset") {
    subject = `[MoneyMind Space] Password Reset Request`;
    text = `Hello,\n\nYour 6-digit Password Reset Recovery OTP is: ${code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nMoneyMind Space Team`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #3B82F6; font-weight: 800; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">MoneyMind Space</h2>
          <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 2px;">Security Recovery Portal</span>
        </div>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Hello,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">We received a request to reset your MoneyMind Space account password. To authorize this reset, please use the 6-digit recovery code below:</p>
        <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #111827; font-family: monospace;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">⚠️ <strong>Note:</strong> This recovery code is valid for <strong>10 minutes</strong>. If you did not request this, please secure your email account immediately.</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Best regards,<br><strong>MoneyMind Space Team</strong></p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 30px;">
          This is an automated transmission. Please do not reply directly.
        </p>
      </div>
    `;
  }

  try {
    const result = await sendGeneralEmail({ to: cleanEmail, subject, text, html });
    if (result.success) {
      return res.json({ 
        success: true, 
        mode: result.provider === "demo" ? "demo" : "live", 
        cooldownSeconds: 60,
        code: result.provider === "demo" ? code : undefined
      });
    } else {
      return res.json({ 
        success: true, 
        mode: "demo", 
        cooldownSeconds: 60,
        message: "Delivery fallback active.",
        code: code 
      });
    }
  } catch (err: any) {
    return res.json({ 
      success: true, 
      mode: "demo", 
      cooldownSeconds: 60,
      message: "Delivery fallback active.",
      code: code
    });
  }
}
