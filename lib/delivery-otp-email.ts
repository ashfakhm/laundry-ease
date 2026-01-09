import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  if (!user) return `***@${domain}`;
  const prefix = user.slice(0, Math.min(2, user.length));
  return `${prefix}***@${domain}`;
}

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

export async function sendDeliveryOtpEmail(opts: {
  to: string;
  otp: string;
  orderId: string;
  ttlMinutes?: number;
}) {
  const { to, otp, orderId, ttlMinutes = 10 } = opts;

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
