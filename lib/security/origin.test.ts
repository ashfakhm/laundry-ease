import { describe, expect, it } from "vitest";
import {
  collectAllowedOriginsFromRequest,
  extractRequestOrigin,
  isUnsafeHttpMethod,
  normalizeOrigin,
} from "./origin";

describe("origin helpers", () => {
  it("identifies unsafe HTTP methods", () => {
    expect(isUnsafeHttpMethod("POST")).toBe(true);
    expect(isUnsafeHttpMethod("patch")).toBe(true);
    expect(isUnsafeHttpMethod("GET")).toBe(false);
  });

  it("normalizes origins and rejects invalid values", () => {
    expect(normalizeOrigin("https://Example.com/path?q=1")).toBe(
      "https://example.com",
    );
    expect(normalizeOrigin("null")).toBeNull();
    expect(normalizeOrigin("not-a-url")).toBeNull();
  });

  it("extracts request origin from origin header or referer fallback", () => {
    const fromOriginHeader = new Headers({
      origin: "https://app.laundryease.test",
    });
    expect(extractRequestOrigin(fromOriginHeader)).toBe(
      "https://app.laundryease.test",
    );

    const fromReferer = new Headers({
      referer: "https://laundryease.test/dashboard",
    });
    expect(extractRequestOrigin(fromReferer)).toBe("https://laundryease.test");
  });

  it("collects allowed origins from request URL, host and env values", () => {
    const headers = new Headers({
      host: "laundryease.test",
      "x-forwarded-proto": "https",
    });

    const allowed = collectAllowedOriginsFromRequest({
      requestUrl: "https://laundryease.test/api/bookings",
      headers,
      envOrigins: [
        "https://app.laundryease.test",
        "https://laundryease.test",
        undefined,
      ],
    });

    expect(allowed).toContain("https://laundryease.test");
    expect(allowed).toContain("https://app.laundryease.test");
  });

  it("expands localhost loopback aliases for local development", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    });

    const allowed = collectAllowedOriginsFromRequest({
      requestUrl: "http://localhost:3000/api/complaints/1/messages",
      headers,
      envOrigins: [],
    });

    expect(allowed).toContain("http://localhost:3000");
    expect(allowed).toContain("http://127.0.0.1:3000");
    expect(allowed).toContain("http://[::1]:3000");
  });
});
