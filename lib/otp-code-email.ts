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

export type OtpCodeEmailPayload = {
  to: string;
  code: string;
  ttlMinutes: number;
};

export async function sendOtpCodeEmailNow(opts: OtpCodeEmailPayload) {
  const { to, code, ttlMinutes } = opts;
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject: "Your OTP Code",
    text: `Your OTP code is ${code}. It will expire in ${ttlMinutes} minutes.`,
  });

  logger.info("OTP", "OTP code email sent", {
    to: maskEmail(to),
  });
}
