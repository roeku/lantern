import fc from 'fast-check';

const DEFAULT_RUNS = 100;
const MAX_RUNS = 1_000_000;

// Returns a base-10 integer in [1, 1_000_000], else the default.
export function parseNumRuns(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_RUNS;
  if (!/^[0-9]+$/.test(raw)) return DEFAULT_RUNS;
  const n = Number.parseInt(raw, 10);
  return n >= 1 && n <= MAX_RUNS ? n : DEFAULT_RUNS;
}

fc.configureGlobal({ numRuns: parseNumRuns(process.env.FC_NUM_RUNS) });
