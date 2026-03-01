import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getEmailTransporter } from "@/lib/email-transporter";

export type AlertDigestItem = {
  id: string;
  severity: "critical" | "high";
  key: string;
  message: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type AlertDigestPayload = {
  kind: "notify" | "escalate";
  generatedAt: string;
  totalOpen: number;
  criticalOpen: number;
  highOpen: number;
  items: AlertDigestItem[];
};

export type AlertDeliveryResult = {
  emailSent: boolean;
  webhookSent: boolean;
  skipped: boolean;
  reason?: string;
};



function parseEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(payload: AlertDigestPayload): string {
  const rows = payload.items
    .map((item) => {
      return `<tr>
  <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.severity.toUpperCase())}</td>
  <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.key)}</td>
  <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.message)}</td>
  <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.firstSeenAt)}</td>
  <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.lastSeenAt)}</td>
</tr>`;
    })
    .join("");

  return `
<div style="font-family:Arial,sans-serif;color:#111">
  <h2>LaundryEase Alert ${payload.kind === "escalate" ? "Escalation" : "Digest"}</h2>
  <p>Generated at: ${escapeHtml(payload.generatedAt)}</p>
  <p>Open alerts: ${payload.totalOpen} (critical: ${payload.criticalOpen}, high: ${payload.highOpen})</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <thead>
      <tr>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Severity</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Key</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Message</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">First Seen</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Last Seen</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>
`;
}

export async function deliverAlertDigest(
  payload: AlertDigestPayload,
): Promise<AlertDeliveryResult> {
  const recipients = parseEmails(env.OPS_ALERT_EMAIL_TO);
  const webhookUrl = env.OPS_ALERT_WEBHOOK_URL || "";
  const webhookBearer = env.OPS_ALERT_WEBHOOK_BEARER || "";

  if (recipients.length === 0 && !webhookUrl) {
    return {
      emailSent: false,
      webhookSent: false,
      skipped: true,
      reason: "No alert channel configured",
    };
  }

  let emailSent = false;
  let webhookSent = false;

  if (recipients.length > 0) {
    const subjectPrefix = payload.kind === "escalate" ? "[ESCALATION]" : "[ALERT]";
    await getEmailTransporter().sendMail({
      from: env.EMAIL_USER,
      to: recipients.join(", "),
      subject: `${subjectPrefix} LaundryEase system alerts (${payload.items.length})`,
      text: JSON.stringify(payload, null, 2),
      html: buildEmailHtml(payload),
    });
    emailSent = true;
  }

  if (webhookUrl) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (webhookBearer) {
      headers.authorization = `Bearer ${webhookBearer}`;
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error(
        "OPS_ALERTS",
        `Webhook alert delivery failed (${response.status})`,
        body,
      );
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }
    webhookSent = true;
  }

  return {
    emailSent,
    webhookSent,
    skipped: false,
  };
}
