/**
 * BENCHMARK: Array-of-Structs vs Struct-of-Arrays
 *
 * We prove — with measured nanoseconds — that the SoA layout
 * is faster for the access pattern used by our renderer.
 *
 * THE ACCESS PATTERN:
 *   The renderer iterates all N rows and reads: bid, ask, last, change, changePct.
 *   It does NOT need volume, high, low, open, timestamp in the same pass.
 *   This is a classic "column scan" access pattern. SoA wins this by 8x in cache lines.
 *
 * METHODOLOGY (Carmack/Feynman standard):
 *   1. Warmup: Run 20 iterations to allow JIT to compile and stabilize.
 *   2. Measurement: Run 200 iterations. Record each individually.
 *   3. Statistics: Report min, max, mean, and p99.
 *   4. Controlled: Both benchmarks run in the same process, same GC state.
 *      We explicitly avoid any allocation inside the measured loop.
 *
 * WHAT WE ARE MEASURING:
 *   The time to sum all bid prices across N rows (a proxy for "iterate all rows
 *   and read the bid field"). The sum forces the compiler not to optimize away
 *   the reads. The result is printed to prevent dead code elimination.
 */

const N          = 10_000;    // rows
const WARMUP     = 20;        // JIT warmup iterations
const ITERATIONS = 200;       // measured iterations

// ─── AoS: Array of Structs ──────────────────────────────────────────────────
// This is what you get from a naïve JavaScript implementation.
// Each object is ~80+ bytes. Accessing `bid` across 10k objects
// touches up to 10,000 separate cache lines.

interface TradeRowAoS {
  bid:       number;
  ask:       number;
  last:      number;
  volume:    number;
  change:    number;
  changePct: number;
  high:      number;
  low:       number;
  open:      number;
  timestamp: number;
}

function buildAoS(n: number): TradeRowAoS[] {
  const rows: TradeRowAoS[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      bid:       100 + Math.random(),
      ask:       100 + Math.random() + 0.01,
      last:      100 + Math.random(),
      volume:    1000 + Math.random() * 1000,
      change:    (Math.random() - 0.5) * 5,
      changePct: (Math.random() - 0.5) * 0.05,
      high:      101 + Math.random(),
      low:       99  + Math.random(),
      open:      100 + Math.random(),
      timestamp: Date.now(),
    });
  }
  return rows;
}

// ─── SoA: Struct of Arrays ──────────────────────────────────────────────────
// All bids are contiguous Float64Array. Reading all bids touches
// ceil(10000 * 8 / 64) = 1,250 cache lines. 8x fewer than AoS.

interface TradeBookSoA {
  bid:       Float64Array;
  ask:       Float64Array;
  last:      Float64Array;
  volume:    Float64Array;
  change:    Float64Array;
  changePct: Float64Array;
  high:      Float64Array;
  low:       Float64Array;
  open:      Float64Array;
  timestamp: Float64Array;
}

function buildSoA(n: number): TradeBookSoA {
  const book: TradeBookSoA = {
    bid:       new Float64Array(n),
    ask:       new Float64Array(n),
    last:      new Float64Array(n),
    volume:    new Float64Array(n),
    change:    new Float64Array(n),
    changePct: new Float64Array(n),
    high:      new Float64Array(n),
    low:       new Float64Array(n),
    open:      new Float64Array(n),
    timestamp: new Float64Array(n),
  };
  for (let i = 0; i < n; i++) {
    book.bid[i]       = 100 + Math.random();
    book.ask[i]       = 100 + Math.random() + 0.01;
    book.last[i]      = 100 + Math.random();
    book.volume[i]    = 1000 + Math.random() * 1000;
    book.change[i]    = (Math.random() - 0.5) * 5;
    book.changePct[i] = (Math.random() - 0.5) * 0.05;
    book.high[i]      = 101 + Math.random();
    book.low[i]       = 99  + Math.random();
    book.open[i]      = 100 + Math.random();
    book.timestamp[i] = Date.now();
  }
  return book;
}

// ─── The measured operation ─────────────────────────────────────────────────
// Sum all bid values. This is representative of the renderer's read pattern.
// We use a pre-allocated result variable — zero allocations.

let _sink = 0; // Prevent dead code elimination

function sumBidsAoS(rows: TradeRowAoS[]): number {
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    // Non-null assertion: we know rows[i] exists — no bounds check overhead
    sum += rows[i]!.bid;
  }
  return sum;
}

function sumBidsSoA(book: TradeBookSoA): number {
  let sum = 0;
  const bids = book.bid; // Local reference — avoids property lookup in loop
  for (let i = 0; i < bids.length; i++) {
    sum += bids[i]!;
  }
  return sum;
}

// ─── Benchmark runner ────────────────────────────────────────────────────────

function runBench(name: string, fn: () => number, warmup: number, iters: number): void {
  // Warmup: allow JIT to optimize the hot function
  for (let i = 0; i < warmup; i++) {
    _sink += fn();
  }

  // Measured runs
  const times = new Float64Array(iters);
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    _sink += fn();
    times[i] = performance.now() - t0;
  }

  // Statistics — all computed without allocating new arrays
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    if (t < min) min = t;
    if (t > max) max = t;
    sum += t;
  }
  const mean = sum / iters;

  // p99: sort a copy (we must sort — this allocation is outside the hot path)
  const sorted = Float64Array.from(times).sort();
  const p99    = sorted[Math.floor(iters * 0.99)]!;

  console.log(`\n─── ${name} ───`);
  console.log(`  min:  ${min.toFixed(4)} ms`);
  console.log(`  mean: ${mean.toFixed(4)} ms`);
  console.log(`  p99:  ${p99.toFixed(4)} ms`);
  console.log(`  max:  ${max.toFixed(4)} ms`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function runSoaVsAosBenchmark(): void {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  SoA vs AoS Benchmark  —  N=${N.toLocaleString()} rows`);
  console.log(`  Warmup: ${WARMUP} iters  |  Measured: ${ITERATIONS} iters`);
  console.log('═'.repeat(55));

  const aosData = buildAoS(N);
  const soaData = buildSoA(N);

  console.log(`\nMemory layout (theoretical):`);
  console.log(`  AoS: each row ~${10 * 8} bytes, bid field at +0. Accessing all bids = ${N} cache line loads (worst case)`);
  console.log(`  SoA: bids in contiguous Float64Array. Accessing all bids = ${Math.ceil(N * 8 / 64)} cache line loads`);
  console.log(`  Cache efficiency ratio: ${(N / Math.ceil(N * 8 / 64)).toFixed(1)}x`);

  runBench('AoS — Array of Structs (naïve objects)', () => sumBidsAoS(aosData), WARMUP, ITERATIONS);
  runBench('SoA — Struct of Arrays (Float64Array)', () => sumBidsSoA(soaData), WARMUP, ITERATIONS);

  // Prevent the compiler from dead-code-eliminating our benchmark
  if (_sink === 0) console.log('(sink check — will never print)');
}
