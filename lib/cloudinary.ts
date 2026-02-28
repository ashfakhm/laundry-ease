import cloudinary from "cloudinary";
import { env } from "@/lib/env";

cloudinary.v2.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadInvoicePhoto(
  file: Buffer,
  filename: string,
  _mimetype: string,
) {
  return new Promise<string>((resolve, reject) => {
    cloudinary.v2.uploader
      .upload_stream(
        {
          folder: "invoices",
          public_id: `${Date.now()}-${filename}`,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result?.secure_url || "");
        },
      )
      .end(file);
  });
}
