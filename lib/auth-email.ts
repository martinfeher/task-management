import nodemailer from "nodemailer";

type SendAuthEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends transactional auth mail when SMTP is configured; otherwise logs the
 * payload in development (see .env.example).
 */
export async function sendAuthEmail(params: SendAuthEmailParams): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.SMTP_FROM?.trim() || user || "noreply@localhost";

  if (!host || !user) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[auth-email] SMTP not configured — would send email:\n",
        `To: ${params.to}\nSubject: ${params.subject}\n\n${params.text}`,
      );
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html ?? `<pre style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(params.text)}</pre>`,
  });
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
