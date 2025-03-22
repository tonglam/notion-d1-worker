import type { RateLimiterOptions, RequestRecord } from "../types";

// State management (using closures to maintain state)
let requestsPerSecond: RequestRecord[] = [];
let requestsPerMinute: RequestRecord[] = [];

/**
 * Clean old requests from tracking arrays
 */
const cleanOldRequests = (): void => {
  const now = Date.now();
  requestsPerSecond = requestsPerSecond.filter(
    (req) => now - req.timestamp < 1000
  );
  requestsPerMinute = requestsPerMinute.filter(
    (req) => now - req.timestamp < 60000
  );
};

/**
 * Create a delay promise
 */
const delay = async (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wait until rate limits allow a new request
 */
export const waitForAvailability = async (
  options: RateLimiterOptions
): Promise<void> => {
  while (true) {
    cleanOldRequests();

    const secondWindow = requestsPerSecond.length;
    const minuteWindow = requestsPerMinute.length;

    if (
      secondWindow < options.maxRequestsPerSecond &&
      minuteWindow < options.maxRequestsPerMinute
    ) {
      break;
    }

    await delay(100);
  }

  const request: RequestRecord = { timestamp: Date.now() };
  requestsPerSecond.push(request);
  requestsPerMinute.push(request);
};

/**
 * Wrap a function with rate limiting
 */
export const withRateLimit = async <T>(
  fn: () => Promise<T>,
  options: RateLimiterOptions
): Promise<T> => {
  await waitForAvailability(options);
  return fn();
};
