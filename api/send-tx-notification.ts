import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from "nodemailer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, userName, type, status, amount } = req.body;
  if (!email || !type || !status) {
    return res.status(400).json({ error: "Required fields missing." });
  }

  let hostStr = (process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const host = hostStr.split(" ")[0] || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_SMTP_PORT || "465");
  const secure = process.env.EMAIL_SMTP_SECURE !== "false";
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const pass = process.env.EMAIL_SMTP_PASS?.trim();

  if (!user || !pass) {
    return res.json({ success: true, message: "Demo mode: No SMTP credentials." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"MoneyMind Space" <${user}>`,
      to: email,
      subject: `[MoneyMind Space] Your ${type.charAt(0).toUpperCase() + type.slice(1)} has been ${status.toUpperCase()}`,
      text: `Hello ${userName || 'User'},\n\nYour ${type} of $${amount?.toFixed(2) || 'N/A'} has been ${status}.\n\nBest regards,\nMoneyMind Space Administration`,
      html: `<p>Hello ${userName || 'User'},</p><p>Your ${type} of $${amount?.toFixed(2) || 'N/A'} has been ${status}.</p>`
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: `SMTP Error: ${err.message || 'Unknown'}` });
  }
}
