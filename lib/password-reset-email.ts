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

const TOKEN_EXPIRY_MINUTES = 60;

function buildPasswordResetHtml(resetUrl: string, recipientEmail: string) {
  const maskedEmail = maskEmail(recipientEmail);
  const expiryText = `${TOKEN_EXPIRY_MINUTES} minutes`;
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password - LaundryEase</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: #059669; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
                LaundryEase
              </h1>
              <p style="margin: 4px 0 0 0; color: #d1fae5; font-size: 13px; font-weight: 400;">
                Your trusted laundry service partner
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 36px 32px 24px 32px;">

              <!-- Lock icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #ecfdf5; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; text-align: center; font-size: 28px;">
                  🔒
                </div>
              </div>

              <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600; text-align: center;">
                Password Reset Request
              </h2>

              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                We received a request to reset the password for the account associated with
                <strong style="color: #374151;">${maskedEmail}</strong>.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetUrl}"
                   style="display: inline-block; padding: 14px 36px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; mso-padding-alt: 14px 36px;">
                  Reset My Password
                </a>
              </div>

              <!-- Expiry notice -->
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                  ⏰ <strong>This link expires in ${expiryText}.</strong>
                  After that, you'll need to request a new reset link.
                </p>
              </div>

              <!-- Fallback link -->
              <p style="margin: 0 0 6px 0; color: #9ca3af; font-size: 12px;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 12px; word-break: break-all; line-height: 1.6; background-color: #f9fafb; padding: 10px 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                ${resetUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <!-- Security notice -->
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px;">
                <p style="margin: 0 0 6px 0; color: #991b1b; font-size: 13px; font-weight: 600;">
                  🛡️ Didn't request this?
                </p>
                <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
                  If you didn't request a password reset, you can safely ignore this email.
                  Your password will remain unchanged, and the link above will expire automatically.
                  No one can access your account without this link.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                This is an automated security email from LaundryEase.
                Please do not reply to this email.
              </p>
              <p style="margin: 0; color: #d1d5db; font-size: 11px; text-align: center;">
                &copy; ${currentYear} LaundryEase. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildPasswordResetText(resetUrl: string, recipientEmail: string) {
  const maskedEmail = maskEmail(recipientEmail);

  return [
    "Password Reset Request - LaundryEase",
    "",
    `We received a request to reset the password for the account associated with ${maskedEmail}.`,
    "",
    "Click the link below to reset your password:",
    resetUrl,
    "",
    `This link will expire in ${TOKEN_EXPIRY_MINUTES} minutes. After that, you'll need to request a new one.`,
    "",
    "If you didn't request this, you can safely ignore this email. Your password will remain unchanged.",
    "",
    "— The LaundryEase Team",
  ].join("\n");
}

export async function sendPasswordResetEmailNow(
  opts: PasswordResetEmailPayload,
) {
  const { to, resetUrl } = opts;
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: `"LaundryEase" <${env.EMAIL_USER}>`,
    to,
    subject: "Reset your LaundryEase password",
    text: buildPasswordResetText(resetUrl, to),
    html: buildPasswordResetHtml(resetUrl, to),
  });

  logger.info("AUTH", "Password reset email sent", { to: maskEmail(to) });
}
