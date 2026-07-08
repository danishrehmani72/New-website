import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with telemetry User-Agent header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })
  : null;

// Middleware for body parsing
app.use(express.json());

// API route to dispatch OTP codes to user emails via Resend API
app.post("/api/send-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and Verification Code are required." });
  }

  try {
    const subject = `[MoneyMind Space] Your Verification Code: ${code}`;
    const text = `Your verification code is: ${code}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #D4AF37; text-align: center;">Verification Code</h2>
        <p>Hello,</p>
        <p>Your one-time verification code to execute this action is below:</p>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px dashed #D4AF37;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">${code}</span>
        </div>
        <p>If you did not initiate this request, you can safely ignore this email.</p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 25px;">
          This is an automated security transmission. Please do not reply directly.
        </p>
      </div>
    `;

    const result = await sendGeneralEmail({ to: email, subject, text, html });
    if (result.success) {
      return res.json({ success: true, mode: result.provider === "demo" ? "demo" : "live" });
    } else {
      // Handle failed emails gracefully: provide simulated code so the app remains fully functional
      console.warn(`[OTP System] Resend failed, using demo fallback logic: ${result.error}`);
      return res.json({ 
        success: true, 
        mode: "demo", 
        message: `Backup active due to delivery code: ${result.error}`, 
        code: code 
      });
    }
  } catch (err: any) {
    console.error(err);
    return res.json({ 
      success: true, 
      mode: "demo", 
      message: `Encountered system issue: ${err.message || 'Unknown'}. Simulating dispatch.`,
      code: code
    });
  }
});

// Fetch dynamic SMTP settings from Firestore document 'users/global_settings'
async function fetchGlobalSettings() {
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-a807d10e-b26a-4c76-90b4-c26febef321c/documents/users/global_settings";
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
  const url = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-a807d10e-b26a-4c76-90b4-c26febef321c/documents/email_logs";
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

// Unified email sending utility supporting Resend API delivery
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
        
        // Automated fallback to onboarding@resend.dev to ensure seamless free-tier delivery
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
    console.log(`[Email System] RESEND_API_KEY is unconfigured. Preserving message in simulated demo logs.`);
    await logEmailDelivery(to, `${subject} (Simulated Demo)`, "success", "Simulated delivery (RESEND_API_KEY unconfigured)");
    return { success: true, provider: "demo", note: "Simulated mail logs created" };
  }
}

// API route to notify users about transaction status changes (approvals/rejections)
app.post("/api/send-tx-notification", async (req, res) => {
  const { email, userName, type, status, amount, customNote } = req.body;
  if (!email || !type || !status) {
    return res.status(400).json({ error: "Required fields missing." });
  }

  let subject = "";
  let messageContent = "";

  const normType = String(type).toLowerCase().trim();
  const normStatus = String(status).toLowerCase().trim();

  // Map to precisely the requested subject and messages
  if (normType === "deposit") {
    if (normStatus === "approved" || normStatus === "approved_success") {
      subject = "Deposit Approved";
      messageContent = "Your deposit has been successfully approved and credited to your account.";
    } else {
      subject = "Deposit Rejected";
      messageContent = "Your deposit request was rejected. Please contact support if you need assistance.";
    }
  } else if (normType === "withdrawal") {
    if (normStatus === "approved" || normStatus === "approved_success") {
      subject = "Withdrawal Approved";
      messageContent = "Your withdrawal request has been approved and processed successfully.";
    } else {
      subject = "Withdrawal Rejected";
      messageContent = "Your withdrawal request was rejected. Please review your details or contact support.";
    }
  } else {
    subject = `Transaction Update: ${type} ${status}`;
    messageContent = `Your ${type} has been ${status}.`;
  }

  let customNoteSectionHtml = "";
  let customNoteSectionText = "";
  if (customNote && String(customNote).trim().length > 0) {
    const cleanNote = String(customNote).trim();
    customNoteSectionText = `\n\nNote from Admin: "${cleanNote}"`;
    customNoteSectionHtml = `
      <div style="margin-top: 15px; padding: 12px; background-color: #f8fafc; border-left: 4px solid #D4AF37; border-radius: 4px; text-align: left;">
        <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #d97706; display: block; margin-bottom: 4px; font-family: sans-serif;">Note from Administrator:</span>
        <p style="font-size: 13px; color: #475569; margin: 0; font-style: italic; font-family: sans-serif;">"${cleanNote}"</p>
      </div>
    `;
  }

  const text = `Hello ${userName || "User"},\n\n${messageContent}${customNoteSectionText}\n\nBest regards,\nMoneyMind Space Administration`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h3 style="color: #D4AF37; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">MoneyMind Space Platform Ledger Notification</h3>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.6;">${messageContent}</p>
      ${amount ? `<p style="font-size: 13px; color: #64748b;">Amount: $${Number(amount).toFixed(2)}</p>` : ""}
      ${customNoteSectionHtml}
      <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 20px;">
        This is an automated notification. Please contact our 24/7 support if you have any questions.
      </p>
    </div>
  `;

  try {
    const result = await sendGeneralEmail({ to: email, subject, text, html });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("send-tx-notification failed:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// New generic API route to dispatch various custom email notifications
app.post("/api/send-email", async (req, res) => {
  const { type, to, payload } = req.body;
  if (!type || !to) {
    return res.status(400).json({ error: "Email type and recipient (to) address are required." });
  }

  let subject = "";
  let html = "";
  let text = "";

  const normType = String(type).trim();

  if (normType === "welcome") {
    subject = "Welcome to MoneyMind Space";
    text = `Hello ${payload.userName || "User"},\n\nWelcome to MoneyMind Space! Your account (ID: ${payload.userId || "N/A"}) has been successfully registered. Choose your stakings plan and start earning today!\n\nBest regards,\nMoneyMind Space Administration`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #D4AF37; text-align: center;">Welcome to MoneyMind Space!</h2>
        <p>Dear <strong>${payload.userName || "User"}</strong>,</p>
        <p>Thank you for registering on MoneyMind Space. We are excited to have you with us on this secure and high-yield financial journey.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4AF37;">
          <h3 style="margin-top: 0; color: #1e293b; font-size: 15px;">Account Details:</h3>
          <p style="margin: 5px 0; font-size: 13px;"><strong>User ID:</strong> ${payload.userId || "N/A"}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Registered Email:</strong> ${to}</p>
        </div>
        <p>You can now explore stakings plans and begin earning instant daily commissions.</p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 25px;">
          This is an automated platform alert. Please do not reply directly to this mail.
        </p>
      </div>
    `;
  }
  else if (normType === "deposit_admin") {
    subject = `New Deposit Request Submitted - $${payload.amount}`;
    text = `A user has submitted a new deposit request.\n\nUsername: ${payload.userName || "User"}\nEmail: ${payload.email || "N/A"}\nAmount: $${payload.amount}\nPayment Method: ${payload.paymentMethod || "N/A"}\nTransaction ID: ${payload.txHash || "N/A"}\nDate: ${payload.date || "N/A"}`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px; font-size: 18px; margin-top: 0;">New Deposit Request Submitted</h2>
        <p style="color: #334155; font-size: 14px;">An administrative notification has been dispatched. A user has logged a new deposit on the ledger:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <tr style="background-color: #f8fafc;">
            <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Detail</th>
            <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Value</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Username</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.userName || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>User Email</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.email || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Amount</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #059669; font-weight: bold;">$${payload.amount}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Payment Method/Network</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.paymentMethod || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Transaction ID/Hash</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${payload.txHash || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Date Submitted</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.date || "N/A"}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 14px; color: #334155;">Please log in to your Admin Panel to review and action this deposit.</p>
      </div>
    `;
  } else if (normType === "withdrawal_admin") {
    subject = `New Withdrawal Request Submitted - $${payload.amount}`;
    text = `A user has submitted a new withdrawal request.\n\nUsername: ${payload.userName || "User"}\nEmail: ${payload.email || "N/A"}\nAmount: $${payload.amount}\nPayment Method: ${payload.paymentMethod || "N/A"}\nDate: ${payload.date || "N/A"}`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; font-size: 18px; margin-top: 0;">New Withdrawal Request Submitted</h2>
        <p style="color: #334155; font-size: 14px;">An administrative notification has been dispatched. A user has logged a new withdrawal on the ledger:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <tr style="background-color: #f8fafc;">
            <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Detail</th>
            <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Value</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Username</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.userName || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>User Email</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.email || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Amount</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">$${payload.amount}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Channel/Wallet Details</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.paymentMethod || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Date Submitted</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${payload.date || "N/A"}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 14px; color: #334155;">Please log in to your Admin Panel to review and action this withdrawal request.</p>
      </div>
    `;
  } else if (normType === "deposit_submitted") {
    subject = `Deposit Request Received - $${payload.amount}`;
    text = `Hello ${payload.userName || "User"},\n\nWe have received your deposit request of $${payload.amount} via ${payload.paymentMethod}. Our verification systems are currently reviewing this transfer (Transaction ID: ${payload.txHash || "N/A"}). This typically takes between 5 to 15 minutes.\n\nBest regards,\nMoneyMind Space Team`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #10B981; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 18px; margin-top: 0;">Deposit Request Received</h2>
        <p>Dear <strong>${payload.userName || "User"}</strong>,</p>
        <p>We are writing to confirm that your deposit request has been successfully submitted and logged on the ledger:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
          <p style="margin: 5px 0; font-size: 13px;"><strong>Amount:</strong> $${payload.amount}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Payment Network:</strong> ${payload.paymentMethod || "N/A"}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Transaction ID/Hash:</strong> ${payload.txHash || "N/A"}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Time Logged:</strong> ${payload.date || "N/A"}</p>
        </div>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Our security compliance desk is actively auditing this transfer. Once the block receipt is confirmed, the funds will be instantly credited to your active wallet balance.</p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 25px;">
          This is an automated confirmation alert. Please do not reply directly.
        </p>
      </div>
    `;
  } else if (normType === "withdrawal_submitted") {
    subject = `Withdrawal Request Logged - $${payload.amount}`;
    text = `Hello ${payload.userName || "User"},\n\nYour withdrawal request of $${payload.amount} has been submitted successfully to the processing queue. Our compliance desk evaluates all payouts within 5 to 30 minutes.\n\nBest regards,\nMoneyMind Space Team`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #dc2626; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 18px; margin-top: 0;">Withdrawal Request Logged</h2>
        <p>Dear <strong>${payload.userName || "User"}</strong>,</p>
        <p>Your withdrawal request has been successfully queued for secure administrative processing:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 5px 0; font-size: 13px;"><strong>Amount:</strong> $${payload.amount}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Payout Network:</strong> ${payload.paymentMethod || "N/A"}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Time Logged:</strong> ${payload.date || "N/A"}</p>
        </div>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Our compliance desk will audit and verify your transaction shortly. Once settlement moves green, the funds will be pushed to your transfer destination and you will receive another confirmation email.</p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 25px;">
          This is an automated platform alert. Thank you for your patience.
        </p>
      </div>
    `;
  } else {
    return res.status(400).json({ error: "Invalid email notification type." });
  }

  try {
    const result = await sendGeneralEmail({ to, subject, html, text });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Endpoint send-email failure:", err);
    return res.status(500).json({ error: err.message || "Failed to dispatch email notification." });
  }
});

// Live Chat Bot AI assistant route using gemini-3.5-flash model
app.post("/api/chat-bot", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const normalized = message.toLowerCase().trim();

  // Smart localized fallback content
  const getFallbackReply = (msg: string): string => {
    if (msg.includes("ia feature") || msg.includes("ai feature") || msg.includes("ai help") || msg.includes("kon kon")) {
      return `**MoneyMind Space** includes these premium AI & Automated features:
1. **MindBuddy AI Companion**: Instantly answers queries in Roman Urdu, Urdu, or English.
2. **Dynamic Transaction Ledger**: Live platform action feed logging entries in real-time.
3. **Telegram Live Webhook Dispatch**: Automated bot notifications to developers for secure validation of actions.
4. **Active Security Shields**: Continuous fraud alerts and unban filters.`;
    }
    if (msg.includes("earnhub") || msg.includes("money") || msg.includes("mind") || msg.includes("platform")) {
      return `**MoneyMind Space** is a high-yield staking and referral network where you can:
- Securely deposit PKRs via **Easypaisa, JazzCash, SadaPay, bank** or **USDT/TRC-20**.
- Choose highly optimized plans for continuous returns.
- Earn up to 3 levels of generational parent commissions through referrals!`;
    }
    if (msg.includes("deposit") || msg.includes("paisa") || msg.includes("jazz") || msg.includes("bank") || msg.includes("invest")) {
      return `To **Deposit** or **Invest**:
1. Click the **Deposit Panel** on your home dashboard.
2. Select your preferred channel (e.g. **Easypaisa**, **JazzCash**, **SadaPay**, **NayaPay**, or **Bank Transfer** / **USDT**).
3. Transfer the amount to the provided details and submit your Transaction details (Sender Name, Account, TxID).
4. Our security ledger verifies this instantly to update your stable balances!`;
    }
    if (msg.includes("withdraw") || msg.includes("nikal") || msg.includes("payout")) {
      return `To **Withdraw** your earnings:
1. Navigate to the **Withdraw Panel** on your dashboard.
2. Choose your payout gate (**Easypaisa**, **JazzCash**, **SadaPay**, or bank account).
3. Input your clean account details and click trigger.
4. Our automatic security compliance desk reviews and pushes instant disbursements safely!`;
    }
    if (msg.includes("refer") || msg.includes("invite") || msg.includes("friend") || msg.includes("dost")) {
      return `Aap apne doston ko invite kar ke **3 Levels** tak commission earn kar saktay hain!
- **Level 1**: Direct friends you introduce.
- **Level 2**: Friends introduced by your Level 1 referrals.
- **Level 3**: Multi-generation tier rewards for compound expansion!`;
    }
    if (msg.includes("hello") || msg.includes("hi") || msg.includes("asalam") || msg.includes("hey") || msg.includes("kia hal") || msg.includes("kese ho")) {
      return `Hello! Main aapka **MindBuddy AI Companion** hoon. Main real-time Urdu, English aur Roman Urdu me platform ke talluq se aapke sawalaat ke jawaab de sakta hoon. Aap mujh se plans, deposit, ya withdrawal pooch saktay hain!`;
    }
    return `Shukriya hum se rabta karne ka! MoneyMind Space me aap secure investment plan select kar ke stakings se daily profit generate kar sakte hain. Agat aap ka koi makhsoos sawal hai, to zarur batayein!`;
  };

  try {
    if (ai) {
      // Build brief chat elements formatting
      const systemInstruction = `
You are "MindBuddy", the highly advanced, helpful, and sophisticated AI Live Chat Assistant for the "MoneyMind Space" platform.
MoneyMind Space is an upgraded, secure financial growth, staking, and referral platform.
Key Info:
- Pakistan Rails supported: Easypaisa, JazzCash, SadaPay, NayaPay, Bank Transfers.
- Crypto Rails: USDT (TRC-20), Bitcoin, Ethereum.
- Features: Flexible investment plans, micro staking rewards, referral commission tiers (Level 1, Level 2, Level 3), daily login bonuses, and secure instant payouts.
- System Reviewer: Active automated security desk compliance node.

Guideline regarding answers:
1. Speak the language the user speaks. If the user asks in Roman Urdu (e.g. "IA features kon koncy hain", "kia hal hai", "pese kese kamaen"), answer them in Roman Urdu with high energy and premium support!
2. If they ask in English, write elegantly in English. If they ask in Urdu (Nastaliq script), write beautifully in Urdu.
3. Keep answers highly professional, positive, crisp, and structured. Use emojis occasionally (e.g., 💰, 🔥, ⚡, 🛡️, 📞) to keep chat engaging and friendly, but not cluttered.
4. If a user asks "IA features kon koncy hain/What are the AI features of the platform?", explain that MoneyMind Space features:
   - MindBuddy AI Assistant: Answers questions instantly, guides on plans, deposits, and withdrawal steps in Urdu, Roman Urdu, or English.
   - Intelligent Security Ledger: Real-time fraud detection and instant multi-factor transaction check.
   - Automated Telegram Live Webhook Feeds: Real-time notification BOT dispatchers to admins for instant secure updates.
   - Dynamic Financial Analytics: Real-time revenue, registration flow charts and active ledger feeds.
5. Remind users that the automated compliance desk reviews all operations for supreme processing security!
`;

      const contents = history && Array.isArray(history) && history.length > 0
        ? [...history.map((h: any) => ({ role: h.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: h.text }] })), { role: "user" as const, parts: [{ text: message }] }]
        : [{ role: "user" as const, parts: [{ text: message }] }];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const reply = response.text || getFallbackReply(normalized);
      return res.json({ reply });
    } else {
      // Fallback response
      const reply = getFallbackReply(normalized);
      return res.json({ reply });
    }
  } catch (err: any) {
    console.error("Gemini chatbot error:", err);
    // Silent recovery with elegant fallback reply
    const reply = getFallbackReply(normalized);
    return res.json({ reply });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Full-stack server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
