import { logger } from "./logger";

/**
 * Telemetry and Business Metrics System
 *
 * Provides a standardized interface for emitting business metrics (counters, gauges, histograms)
 * to Datadog via DogStatsD when APM is enabled.
 */

class Telemetry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private enabled: boolean = false;

  constructor() {
    this.enabled = Boolean(
      process.env.DATADOG_API_KEY || process.env.DD_API_KEY,
    );

    if (this.enabled) {
      try {
        // We use hot-shots as the standard DogStatsD client in Node.js
        // If it's not installed, we fallback gracefully to Pino logging
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const StatsD = require("hot-shots");
        this.client = new StatsD({
          prefix: "laundryease.",
          globalTags: { env: process.env.NODE_ENV || "development" },
          errorHandler: (error: Error) => {
            logger.error("TELEMETRY", "StatsD error", { error: error.message });
          },
        });
      } catch (err) {
        logger.warn(
          "TELEMETRY",
          "hot-shots not installed. Telemetry will fallback to logs.",
          { error: err instanceof Error ? err.message : String(err) },
        );
        this.client = null;
      }
    }
  }

  /**
   * Increments a business metric counter
   * @param metric Name of the metric (e.g. "booking.created")
   * @param value Value to increment by (default 1)
   * @param tags Array of tags to segment metrics (e.g. ["status:paid", "provider:123"])
   */
  public increment(metric: string, value: number = 1, tags?: string[]) {
    if (!this.enabled) return;

    if (this.client) {
      this.client.increment(metric, value, tags);
    } else {
      logger.info("METRIC", `Increment: ${metric} by ${value}`, { tags });
    }
  }

  /**
   * Records a gauge value (e.g. queue length, active users)
   */
  public gauge(metric: string, value: number, tags?: string[]) {
    if (!this.enabled) return;

    if (this.client) {
      this.client.gauge(metric, value, tags);
    } else {
      logger.info("METRIC", `Gauge: ${metric} = ${value}`, { tags });
    }
  }
}

// Singleton export
export const telemetry = new Telemetry();
