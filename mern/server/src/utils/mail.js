import nodemailer from "nodemailer";

function getTransport() {
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass }
  });
}

export async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    console.log(`[mail:dev] ${subject} -> ${to}`);
    if (text) console.log(text);
    return { sent: false, reason: "SMTP not configured" };
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (error) {
    console.error("Mail send failed:", error.message);
    return { sent: false, reason: error.message };
  }
}
