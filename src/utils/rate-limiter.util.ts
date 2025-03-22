import { createLogger } from "./logger.util";

const logger = createLogger("RateLimiter");

interface RateLimiterOptions {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
}

interface RequestRecord {
  timestamp: number;
}

export class RateLimiter {
  private requestsPerSecond: RequestRecord[] = [];
  private requestsPerMinute: RequestRecord[] = [];
  private readonly options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  private cleanOldRequests(): void {
    const now = Date.now();
    this.requestsPerSecond = this.requestsPerSecond.filter(
      (req) => now - req.timestamp < 1000
    );
    this.requestsPerMinute = this.requestsPerMinute.filter(
      (req) => now - req.timestamp < 60000
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async waitForAvailability(): Promise<void> {
    while (true) {
      this.cleanOldRequests();

      const now = Date.now();
      const secondWindow = this.requestsPerSecond.length;
      const minuteWindow = this.requestsPerMinute.length;

      if (
        secondWindow < this.options.maxRequestsPerSecond &&
        minuteWindow < this.options.maxRequestsPerMinute
      ) {
        break;
      }

      logger.debug("Rate limit reached, waiting", {
        secondWindow,
        minuteWindow,
        maxRequestsPerSecond: this.options.maxRequestsPerSecond,
        maxRequestsPerMinute: this.options.maxRequestsPerMinute,
      });

      await this.delay(100);
    }

    const request: RequestRecord = { timestamp: Date.now() };
    this.requestsPerSecond.push(request);
    this.requestsPerMinute.push(request);
  }

  public async wrap<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForAvailability();
    return fn();
  }
}
