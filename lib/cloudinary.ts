import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadInvoicePhoto(
  file: Buffer,
  filename: string,
  mimetype: string
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
        }
      )
      .end(file);
  });
}
