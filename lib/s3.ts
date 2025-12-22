import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: !!process.env.S3_FORCE_PATH_STYLE,
});

export async function uploadInvoicePhoto(
  file: Buffer,
  filename: string,
  mimetype: string
) {
  const bucket = process.env.S3_BUCKET || "laundryease-invoices";
  const key = `invoices/${Date.now()}-${filename}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: mimetype,
      ACL: "public-read",
    })
  );
  return `${
    process.env.S3_PUBLIC_URL || "https://" + bucket + ".s3.amazonaws.com/"
  }${key}`;
}
