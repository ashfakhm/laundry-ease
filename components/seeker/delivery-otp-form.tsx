"use client";
import React, { useState } from "react";

export default function DeliveryOtpForm({ orderId }: { orderId: string }) {
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      if (!res.ok) throw new Error("Invalid OTP or failed to confirm");
      setStatus("confirmed");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message?: string }).message || "Unknown error");
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (status) {
    return <div className="text-success">Delivery confirmed!</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        Enter OTP sent to your phone:
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="input input-bordered mt-2"
          required
          maxLength={6}
        />
      </label>
      {error && <div className="text-error">{error}</div>}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Confirming..." : "Confirm Delivery"}
      </button>
    </form>
  );
}
