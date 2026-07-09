import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from "nodemailer";

// Fetch dynamic SMTP settings from Firestore document 'users/global_settings'
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
    
    // Helper to decode values out of Firestore REST format
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

// Log email delivery status to firestore 'email_logs' root collection
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
    } else {
      console.log(`[Firestore REST] Email log created successfully.`);
    }
  } catch (err) {
    console.error("[Firestore REST] Error writing email log:", err);
  }
}

// Unified email sending utility supporting SMTP and Resend API delivery
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
  console.log(`[Email System] Initiating message dispatch to: ${to}, Subject: "${subject}"`);

  const targetLower = to.toLowerCase().trim();
  if (
    targetLower.includes("no-email") || 
    targetLower.endsWith("@wealthhub.com") || 
    targetLower.endsWith("@moneymindspace.com") || 
    !targetLower.includes("@")
  ) {
    console.log(`[Email System] Filtered placeholder test email ${to} to prevent delivery bounces. Simulating successful local logs.`);
    await logEmailDelivery(to, `${subject} (Simulated Test Account)`, "success", "Filtered placeholder email to prevent delivery bounce");
    return { success: true, provider: "demo", note: "Simulated placeholder email auto-filtered" };
  }

  // 1. Try dynamic SMTP settings from Firestore users/global_settings first
  const settings = await fetchGlobalSettings();
  if (settings && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    try {
      console.log(`[SMTP Engine] Attempting dispatch to SMTP host ${settings.smtpHost}:${settings.smtpPort || 465} for user: ${settings.smtpUser}`);
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
      console.log(`[SMTP Success] Delivered successfully via SMTP to: ${to} (Message ID: ${info.messageId})`);
      await logEmailDelivery(to, subject, "success");
      return { success: true, provider: "smtp", id: info.messageId };
    } catch (smtpErr: any) {
      console.error(`[SMTP Fail] Delivery to ${to} failed:`, smtpErr);
    }
  }

  // 2. Try Vercel / environment-based SMTP config
  const envHost = (process.env.EMAIL_SMTP_HOST || "").trim();
  const envUser = (process.env.EMAIL_SMTP_USER || "").trim();
  const envPass = (process.env.EMAIL_SMTP_PASS || "").trim();
  const envPort = Number(process.env.EMAIL_SMTP_PORT || "465");
  const envSecure = process.env.EMAIL_SMTP_SECURE !== "false";

  if (envHost && envUser && envPass) {
    try {
      console.log(`[Environment SMTP Engine] Attempting dispatch to SMTP host ${envHost}:${envPort} for user: ${envUser}`);
      const transporter = nodemailer.createTransport({
        host: envHost,
        port: envPort,
        secure: envSecure,
        auth: {
          user: envUser,
          pass: envPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const mailOptions = {
        from: `"MoneyMind Space" <${envUser}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Environment SMTP Success] Delivered successfully via SMTP to: ${to} (Message ID: ${info.messageId})`);
      await logEmailDelivery(to, subject, "success");
      return { success: true, provider: "smtp", id: info.messageId };
    } catch (envSmtpErr: any) {
      console.error(`[Environment SMTP Fail] Delivery to ${to} failed:`, envSmtpErr);
    }
  }

  // 3. Fall back to Resend API if configured
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const senderEmail = "support@moneymindspace.online";

  if (resendApiKey) {
    try {
      console.log(`[Resend Engine] Attempting dispatch to Resend API using verified sender <${senderEmail}> for: ${to}`);
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
        console.warn(`[Resend Primary Fail] ${errorText}. Executing automatic retry with onboarding@resend.dev...`);
        
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
      console.log(`[Resend Success] Delivered successfully via Resend API to: ${to} (Message ID: ${resData.id})`);
      await logEmailDelivery(to, subject, "success");
      return { success: true, provider: "resend", id: resData.id };
    } catch (err: any) {
      console.error(`[Resend Fail] Delivery to ${to} failed:`, err);
      const errMsg = err.message || "Resend API transmission error";
      await logEmailDelivery(to, subject, "failed", errMsg);
      return { success: false, provider: "resend", error: errMsg };
    }
  } else {
    console.log(`[Email System] No SMTP or RESEND_API_KEY is configured. Preserving message in simulated demo logs.`);
    await logEmailDelivery(to, `${subject} (Simulated Demo)`, "success", "Simulated delivery (No SMTP or RESEND_API_KEY)");
    return { success: true, provider: "demo", note: "Simulated mail logs created" };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, userName, type, status, amount } = req.body;
  if (!email || !type || !status) {
    return res.status(400).json({ error: "Required fields missing." });
  }

  try {
    const isApproved = status.toLowerCase() === "approved";
    const actionColor = isApproved ? "#10b981" : "#ef4444";
    const subject = `[MoneyMind Space] Your ${type.charAt(0).toUpperCase() + type.slice(1)} transaction has been ${status.toUpperCase()}`;
    const text = `Hello ${userName || 'User'},\n\nYour ${type} of ${amount ? amount.toFixed(2) : 'N/A'} PKR has been ${status}.\n\nBest regards,\nMoneyMind Space Administration`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: ${actionColor}; text-align: center; font-size: 20px; text-transform: uppercase;">Transaction ${status.toUpperCase()}</h2>
        <p>Hello <strong>${userName || 'Valued Member'}</strong>,</p>
        <p>This is an automated status update regarding your financial transaction on <strong>MoneyMind Space</strong>.</p>
        
        <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Transaction Type:</td>
              <td style="padding: 6px 0; font-weight: bold; font-size: 14px; text-transform: capitalize; color: #1e293b;">${type}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Amount:</td>
              <td style="padding: 6px 0; font-weight: bold; font-size: 14px; color: #1e293b;">${amount ? Number(amount).toLocaleString() : 'N/A'} PKR</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Status:</td>
              <td style="padding: 6px 0; font-weight: bold; font-size: 14px; color: ${actionColor}; text-transform: uppercase;">● ${status}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #475569; line-height: 1.6;">Our compliance desk has audited and updated your transaction ledger. Once settlement moves green, the funds will be pushed to your active transfer balance/destination. Thank you for your continued trust in MoneyMind Space.</p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 25px;">
          This is an automated platform alert. Thank you for your patience.
        </p>
      </div>
    `;

    const result = await sendGeneralEmail({ to: email, subject, text, html });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Endpoint send-email failure:", err);
    return res.status(500).json({ error: err.message || "Failed to dispatch email notification." });
  }
}
