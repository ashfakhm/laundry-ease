import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "@/lib/api/errors";

const { mockRequireAuth, mockUploadInvoicePhoto } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockUploadInvoicePhoto: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/cloudinary", () => ({
  uploadInvoicePhoto: mockUploadInvoicePhoto,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST } from "./route";

const USER_ID = "507f1f77bcf86cd799439011";

function createMockFile(
  content: BlobPart = "test image content",
  name = "test.jpg",
  type = "image/jpeg",
  size?: number,
): File {
  const file = new File([content], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size, writable: false });
  }
  return file;
}

function makeRequest(file: File | null | string): Request {
  const formData = new FormData();
  if (file && typeof file !== "string") {
    formData.set("file", file);
  } else if (typeof file === "string") {
    formData.set("file", file); // Invalid string file
  }

  return new Request("https://laundryease.test/api/upload", {
    method: "POST",
    headers: {
      origin: "https://laundryease.test",
    },
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: {
        id: USER_ID,
        email: "user@laundryease.test",
      },
    });
    mockUploadInvoicePhoto.mockResolvedValue(
      "https://cloudinary.test/image.jpg",
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockRequireAuth.mockRejectedValue(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );

      const file = createMockFile();
      const res = await POST(makeRequest(file));

      expect(res.status).toBe(401);
    });
  });

  describe("file validation", () => {
    it("returns 400 when no file is uploaded", async () => {
      const res = await POST(makeRequest(null));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toEqual(
        expect.objectContaining({
          message: "No file uploaded",
        }),
      );
    });

    it("returns 400 when file is a string instead of File object", async () => {
      const res = await POST(makeRequest("not a file"));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toEqual(
        expect.objectContaining({
          message: "No file uploaded",
        }),
      );
    });

    it("returns 400 for invalid file type (gif)", async () => {
      const file = createMockFile("test", "test.gif", "image/gif");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain("Invalid file type");
      expect(data.error.message).toContain("JPG, PNG, and WebP");
    });

    it("returns 400 for invalid file type (pdf)", async () => {
      const file = createMockFile("test", "test.pdf", "application/pdf");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain("Invalid file type");
    });

    it("returns 400 for invalid file type (video)", async () => {
      const file = createMockFile("test", "test.mp4", "video/mp4");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain("Invalid file type");
    });

    it("returns 400 when file size exceeds 5MB", async () => {
      // Create a file larger than 5MB
      const largeContent = new ArrayBuffer(6 * 1024 * 1024); // 6MB
      const file = createMockFile(largeContent, "large.jpg", "image/jpeg");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain("File too large");
      expect(data.error.message).toContain("5MB");
    });
  });

  describe("successful upload", () => {
    it("successfully uploads a JPEG file", async () => {
      const file = createMockFile("test content", "photo.jpg", "image/jpeg");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.url).toBe("https://cloudinary.test/image.jpg");
      expect(mockUploadInvoicePhoto).toHaveBeenCalledWith(
        expect.any(Buffer),
        "photo.jpg",
        "image/jpeg",
      );
    });

    it("successfully uploads a PNG file", async () => {
      const file = createMockFile("test content", "photo.png", "image/png");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUploadInvoicePhoto).toHaveBeenCalledWith(
        expect.any(Buffer),
        "photo.png",
        "image/png",
      );
    });

    it("successfully uploads a WebP file", async () => {
      const file = createMockFile("test content", "photo.webp", "image/webp");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUploadInvoicePhoto).toHaveBeenCalledWith(
        expect.any(Buffer),
        "photo.webp",
        "image/webp",
      );
    });

    it("uploads file at exactly 5MB boundary", async () => {
      // Create a file exactly at 5MB
      const exactSizeContent = new ArrayBuffer(5 * 1024 * 1024);
      const file = createMockFile(exactSizeContent, "exact.jpg", "image/jpeg");
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Cloudinary error handling", () => {
    it("returns 500 when Cloudinary upload fails", async () => {
      mockUploadInvoicePhoto.mockRejectedValue(
        new Error("Cloudinary service unavailable"),
      );

      const file = createMockFile();
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toEqual(
        expect.objectContaining({
          message: "An unexpected error occurred",
        }),
      );
    });

    it("handles AppError from Cloudinary upload", async () => {
      mockUploadInvoicePhoto.mockRejectedValue(
        new AppError(ErrorCode.INTERNAL_ERROR, 500, "Upload failed"),
      );

      const file = createMockFile();
      const res = await POST(makeRequest(file));
      await res.json();

      expect(res.status).toBe(500);
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error during auth", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unexpected error"));

      const file = createMockFile();
      const res = await POST(makeRequest(file));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toEqual(
        expect.objectContaining({
          message: "An unexpected error occurred",
        }),
      );
    });
  });
});
