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

export type PasswordChangedEmailPayload = {
  to: string;
  changedAt: string;
};

export async function sendPasswordChangedEmailNow(
  opts: PasswordChangedEmailPayload,
) {
  const { to, changedAt } = opts;
  const transporter = getEmailTransporter();

  const formattedDate = new Date(changedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  const supportUrl =
    env.NEXT_PUBLIC_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000";

  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject: "LaundryEase - Your Password Was Changed",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #059669; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">LaundryEase</h1>
        </div>

        <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
              ⚠️ Security Notice
            </p>
          </div>

          <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 18px;">Your password was changed</h2>

          <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
            Your LaundryEase account password was successfully changed on:
          </p>

          <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 24px 0;">
            ${formattedDate} (UTC)
          </p>

          <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            If you made this change, no further action is needed.
          </p>

          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: 600;">
              Didn't make this change?
            </p>
            <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
              If you did not change your password, your account may be compromised. Please reset your password immediately and contact our support team.
            </p>
          </div>

          <a href="${supportUrl}/auth" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Sign In to Your Account
          </a>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px 0;" />

          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
            This is an automated security notification from LaundryEase. You're receiving this because a password change was made on the account associated with ${maskEmail(to)}.
          </p>
        </div>
      </div>
    `,
  });

  logger.info("AUTH", "Password changed confirmation email sent", {
    to: maskEmail(to),
  });
}
