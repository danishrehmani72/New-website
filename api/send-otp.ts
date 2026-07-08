import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from "nodemailer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and Verification Code are required." });
  }

  let hostStr = (process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const host = hostStr.split(" ")[0] || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_SMTP_PORT || "465");
  const secure = process.env.EMAIL_SMTP_SECURE !== "false";
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const pass = process.env.EMAIL_SMTP_PASS?.trim();

  if (!user || !pass) {
    return res.json({ success: true, mode: "demo", message: "Demo mode: No SMTP credentials." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"MoneyMind Space" <${user}>`,
      to: email,
      subject: `[MoneyMind Space] Your Verification Code: ${code}`,
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <strong>${code}</strong></p>`
    });

    return res.json({ success: true, mode: "live" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: `SMTP Error: ${err.message || 'Unknown'}` });
  }
}
