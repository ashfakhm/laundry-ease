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

export type PasswordResetEmailPayload = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmailNow(
  opts: PasswordResetEmailPayload,
) {
  const { to, resetUrl } = opts;
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject: "LaundryEase - Password Reset Request",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    `,
  });

  logger.info("AUTH", "Password reset email sent", { to: maskEmail(to) });
}
