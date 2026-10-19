/** Latência simulada das operações (SPEC §6: ≈ 300–600 ms). */
export type LatencyOption = number | { min: number; max: number };

export const DEFAULT_LATENCY: LatencyOption = { min: 300, max: 600 };

export function createDelay(
  latency: LatencyOption = DEFAULT_LATENCY,
  random: () => number = Math.random,
): () => Promise<void> {
  return () => {
    const ms =
      typeof latency === "number"
        ? latency
        : latency.min + random() * Math.max(0, latency.max - latency.min);
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
}
