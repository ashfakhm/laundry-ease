import nodemailer from "nodemailer";
import { env } from "./env";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function getEmailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}
