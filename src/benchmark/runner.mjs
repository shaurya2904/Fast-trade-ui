/**
 * Standalone benchmark runner — executes in Node.js directly.
 * No build step required. We re-implement the benchmark in plain JS
 * here so it can run without TypeScript compilation.
 *
 * Run with: node src/benchmark/runner.mjs
 */

const N          = 10_000;
const WARMUP     = 20;
const ITERATIONS = 200;

let _sink = 0;

// ─── AoS ────────────────────────────────────────────────────────────────────
function buildAoS(n) {
  const rows = [];
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

function sumBidsAoS(rows) {
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    sum += rows[i].bid;
  }
  return sum;
}

// ─── SoA ────────────────────────────────────────────────────────────────────
function buildSoA(n) {
  const book = {
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

function sumBidsSoA(book) {
  let sum = 0;
  const bids = book.bid;
  for (let i = 0; i < bids.length; i++) {
    sum += bids[i];
  }
  return sum;
}

// ─── Runner ──────────────────────────────────────────────────────────────────
function runBench(name, fn, warmup, iters) {
  for (let i = 0; i < warmup; i++) _sink += fn();

  const times = new Float64Array(iters);
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    _sink += fn();
    times[i] = performance.now() - t0;
  }

  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] < min) min = times[i];
    if (times[i] > max) max = times[i];
    sum += times[i];
  }
  const mean = sum / iters;
  const sorted = Float64Array.from(times).sort();
  const p99  = sorted[Math.floor(iters * 0.99)];

  console.log(`\n─── ${name} ───`);
  console.log(`  min:  ${min.toFixed(4)} ms`);
  console.log(`  mean: ${mean.toFixed(4)} ms`);
  console.log(`  p99:  ${p99.toFixed(4)} ms`);
  console.log(`  max:  ${max.toFixed(4)} ms`);
  return mean;
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  SoA vs AoS Benchmark  —  N=${N.toLocaleString()} rows`);
console.log(`  Node.js ${process.version}`);
console.log(`  Warmup: ${WARMUP} iters  |  Measured: ${ITERATIONS} iters`);
console.log('═'.repeat(60));

console.log(`\nTheoretical cache analysis:`);
console.log(`  AoS: Each object ~80 bytes. Accessing bid across ${N.toLocaleString()} rows`);
console.log(`       = up to ${N.toLocaleString()} cache line loads`);
console.log(`  SoA: Float64Array, 8 values/cache-line. ${N.toLocaleString()} bids`);
console.log(`       = ${Math.ceil(N * 8 / 64).toLocaleString()} cache line loads`);
console.log(`  Theoretical ratio: ${(N / Math.ceil(N * 8 / 64)).toFixed(1)}x fewer cache loads`);

const aosData = buildAoS(N);
const soaData = buildSoA(N);

const aosMean = runBench('AoS — Array of plain objects', () => sumBidsAoS(aosData), WARMUP, ITERATIONS);
const soaMean = runBench('SoA — Float64Array (our TradeBook)', () => sumBidsSoA(soaData), WARMUP, ITERATIONS);

console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULT: SoA is ${(aosMean / soaMean).toFixed(2)}x faster (mean)`);
console.log(`  At 60fps over 1 second:`);
console.log(`    AoS total scan cost: ${(aosMean * 60).toFixed(2)} ms`);
console.log(`    SoA total scan cost: ${(soaMean * 60).toFixed(2)} ms`);
console.log(`    Frame budget saved:  ${((aosMean - soaMean) * 60).toFixed(2)} ms/sec`);
console.log('═'.repeat(60));

if (_sink === 0) console.log('(dead code elimination guard — never prints)');
