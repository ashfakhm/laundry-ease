import { env } from "@/lib/env";
import { getEmailTransporter } from "@/lib/email-transporter";
import { logger } from "@/lib/logger";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  if (!user) return `***@${domain}`;
  const prefix = user.slice(0, Math.min(2, user.length));
  return `${prefix}***@${domain}`;
}

export type MagicLinkEmailPayload = {
  to: string;
  verificationLink: string;
};

export async function sendMagicLinkEmailNow(opts: MagicLinkEmailPayload) {
  const { to, verificationLink } = opts;
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject: "Verify Your Email - LaundryEase",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });

  logger.info("AUTH", "Magic link email sent", { to: maskEmail(to) });
}
