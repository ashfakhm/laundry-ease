import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { CRON_JOB_NAMES, type CronJobName } from "@/lib/constants";
import { GET as autoRejectBookings } from "@/app/api/cron/auto-reject-bookings/route";
import { GET as processPayouts } from "@/app/api/cron/process-payouts/route";
import { GET as noShow } from "@/app/api/cron/no-show/route";
import { GET as monitorAbuse } from "@/app/api/cron/monitor-abuse/route";
import { GET as auditIntegrity } from "@/app/api/cron/audit-integrity/route";
import { GET as monitorOperationalHealth } from "@/app/api/cron/monitor-operational-health/route";
import { GET as notifySystemAlerts } from "@/app/api/cron/notify-system-alerts/route";
import { GET as processEmailOutbox } from "@/app/api/cron/process-email-outbox/route";
import { GET as reconciliation } from "@/app/api/cron/reconciliation/route";
import { GET as webhookCleanup } from "@/app/api/cron/webhook-cleanup/route";

type CronRouteRunner = (request: NextRequest) => Promise<Response>;

const CRON_HANDLERS: Record<
  CronJobName,
  {
    path: string;
    handler: CronRouteRunner;
  }
> = {
  "auto-reject-bookings": {
    path: "/api/cron/auto-reject-bookings",
    handler: autoRejectBookings,
  },
  "process-payouts": {
    path: "/api/cron/process-payouts",
    handler: processPayouts,
  },
  "no-show": {
    path: "/api/cron/no-show",
    handler: noShow,
  },
  "monitor-abuse": {
    path: "/api/cron/monitor-abuse",
    handler: monitorAbuse,
  },
  "audit-integrity": {
    path: "/api/cron/audit-integrity",
    handler: auditIntegrity,
  },
  "monitor-operational-health": {
    path: "/api/cron/monitor-operational-health",
    handler: monitorOperationalHealth,
  },
  "notify-system-alerts": {
    path: "/api/cron/notify-system-alerts",
    handler: notifySystemAlerts,
  },
  "process-email-outbox": {
    path: "/api/cron/process-email-outbox",
    handler: processEmailOutbox,
  },
  reconciliation: {
    path: "/api/cron/reconciliation",
    handler: reconciliation,
  },
  "webhook-cleanup": {
    path: "/api/cron/webhook-cleanup",
    handler: webhookCleanup,
  },
};

export function getDemoCronJobs(): readonly CronJobName[] {
  return CRON_JOB_NAMES;
}

export async function runDemoCronJob(job: CronJobName, baseUrl: string) {
  const config = CRON_HANDLERS[job];
  const request = new NextRequest(new URL(config.path, baseUrl), {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.CRON_SECRET}`,
      origin: baseUrl,
    },
  });

  const startedAt = Date.now();
  const response = await config.handler(request);
  const durationMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    payload,
    durationMs,
  };
}
