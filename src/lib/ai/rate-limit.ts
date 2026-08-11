import "server-only";

/**
 * A per-model request pacer.
 *
 * Free API tiers are tight enough that firing lessons in parallel burns the
 * quota on requests that were always going to 429. The limiter spaces requests
 * out, and — crucially — learns the real limit from the first 429 the provider
 * sends back, so one wasted request teaches it the ceiling for the whole run.
 */
export class ModelLimiter {
  private timestamps: number[] = [];
  private cooldownUntil = 0;
  private gate: Promise<void> = Promise.resolve();

  constructor(private rpm: number) {}

  /** Lower the ceiling when the provider tells us what it actually is. */
  learnLimit(rpm: number): void {
    if (rpm > 0 && rpm < this.rpm) this.rpm = rpm;
  }

  /** Hold every request to this model until the provider's retry window passes. */
  penalize(ms: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + ms);
  }

  get limit(): number {
    return this.rpm;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    // Serialise the decision so concurrent callers cannot all pass at once.
    const previous = this.gate;
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      for (;;) {
        if (signal?.aborted) throw new Error("aborted");
        const now = Date.now();

        if (now < this.cooldownUntil) {
          await sleep(this.cooldownUntil - now, signal);
          continue;
        }

        this.timestamps = this.timestamps.filter((stamp) => now - stamp < 60_000);
        if (this.timestamps.length < this.rpm) {
          this.timestamps.push(now);
          return;
        }

        const oldest = this.timestamps[0];
        await sleep(Math.max(250, 60_000 - (now - oldest)), signal);
      }
    } finally {
      release();
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const limiters = new Map<string, ModelLimiter>();

/** Optimistic default; the first 429 corrects it for the rest of the process. */
const DEFAULT_RPM = Number(process.env.COURSEGEN_RPM ?? 30);

export function limiterFor(model: string): ModelLimiter {
  let limiter = limiters.get(model);
  if (!limiter) {
    limiter = new ModelLimiter(DEFAULT_RPM);
    limiters.set(model, limiter);
  }
  return limiter;
}
