import { z } from "zod";

const envSchema = z.object({
  GOOGLE_ID: z.string().min(1),
  GOOGLE_SECRET: z.string().min(1),
  // Add other environment variables here
});

export const env = envSchema.parse(process.env);
