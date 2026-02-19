import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getEmailTransporter } from "@/lib/email-transporter";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  if (!user) return `***@${domain}`;
  const prefix = user.slice(0, Math.min(2, user.length));
  return `${prefix}***@${domain}`;
}

export type DeliveryOtpEmailPayload = {
  to: string;
  otp: string;
  orderId: string;
  ttlMinutes?: number;
};

export async function sendDeliveryOtpEmailNow(opts: DeliveryOtpEmailPayload) {
  const { to, otp, orderId, ttlMinutes = 10 } = opts;
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: env.EMAIL_USER,
    to,
    subject: "LaundryEase Delivery OTP",
    text: `Your LaundryEase delivery OTP is ${otp}. Share this code with your provider only upon delivery. This OTP expires in ${ttlMinutes} minutes.\n\nOrder: ${orderId}`,
  });

  logger.info("ORDERS", "Delivery OTP email sent", {
    orderId,
    to: maskEmail(to),
  });
}

export async function sendDeliveryOtpEmail(opts: DeliveryOtpEmailPayload) {
  await sendDeliveryOtpEmailNow(opts);
}
