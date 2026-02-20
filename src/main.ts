/**
 * Fast Trade UI — Main Entry Point
 *
 * This file is intentionally minimal. Its only job is to:
 * 1. Verify the environment supports our required APIs
 * 2. Initialize the TradeBook
 * 3. Mount the renderer
 *
 * We do NOT initialize any framework. We do NOT load any router.
 * Every byte of code here earns its place.
 */

import { TradeBook, computeLayout } from './data/TradeBook.js';

// ─── Environment capability check ───────────────────────────────────────────
// We check upfront and fail loudly. Silent degradation in a trading UI
// is not acceptable — a trader must know if something is wrong.

const REQUIRED_APIS = [
  ['SharedArrayBuffer', typeof SharedArrayBuffer !== 'undefined'],
  ['Atomics',           typeof Atomics !== 'undefined'],
  ['OffscreenCanvas',   typeof OffscreenCanvas !== 'undefined'],
  ['Worker',            typeof Worker !== 'undefined'],
  ['WebSocket',         typeof WebSocket !== 'undefined'],
] as const;

function checkCapabilities(): void {
  const missing = REQUIRED_APIS.filter(([, supported]) => !supported).map(([name]) => name);
  if (missing.length > 0) {
    document.body.innerHTML = `
      <div style="color:#ff4444;padding:20px;font-family:monospace">
        <h2>FATAL: Missing required APIs</h2>
        <p>The following APIs are not available in this environment:</p>
        <ul>${missing.map(n => `<li>${n}</li>`).join('')}</ul>
        <p>SharedArrayBuffer requires COOP/COEP headers. Check your server config.</p>
      </div>`;
    throw new Error(`Missing APIs: ${missing.join(', ')}`);
  }
}

// ─── Diagnostic panel ───────────────────────────────────────────────────────
// Temporary diagnostics view — will be replaced by the Canvas renderer.

function renderDiagnostics(book: TradeBook): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('No #app element found');

  const layout = book.layout;

  app.innerHTML = `
    <div style="padding:24px;font-family:'Courier New',monospace;font-size:13px;color:#e0e0e0">
      <h1 style="color:#00ff88;margin-bottom:16px">Fast Trade UI — Module 0: Data Structure</h1>

      <h2 style="color:#ffcc00;margin-top:24px">TradeBook Layout (SoA)</h2>
      <table style="border-collapse:collapse;margin-top:8px">
        <tr style="color:#888"><td style="padding:4px 16px 4px 0">Capacity</td><td>${layout.capacity.toLocaleString()} rows</td></tr>
        <tr style="color:#888"><td style="padding:4px 16px 4px 0">Total memory</td><td>${book.memorySizeKB.toFixed(2)} KB (${layout.totalBytes.toLocaleString()} bytes)</td></tr>
        <tr style="color:#888"><td style="padding:4px 16px 4px 0">Per row cost</td><td>${(layout.totalBytes / layout.capacity).toFixed(1)} bytes/row</td></tr>
      </table>

      <h2 style="color:#ffcc00;margin-top:24px">Buffer Field Offsets (cache-line aligned)</h2>
      <table style="border-collapse:collapse;margin-top:8px">
        ${[
          ['bid',       layout.bidOffset],
          ['ask',       layout.askOffset],
          ['last',      layout.lastOffset],
          ['volume',    layout.volumeOffset],
          ['change',    layout.changeOffset],
          ['changePct', layout.changePctOffset],
          ['high',      layout.highOffset],
          ['low',       layout.lowOffset],
          ['open',      layout.openOffset],
          ['timestamp', layout.timestampOffset],
          ['symbolId',  layout.symbolIdOffset],
          ['dirty',     layout.dirtyOffset],
        ].map(([name, offset]) => `
          <tr>
            <td style="color:#aaa;padding:2px 16px 2px 0">${name}</td>
            <td style="color:#00aaff">+${(offset as number).toLocaleString()} bytes</td>
            <td style="color:#555;padding-left:16px">${(offset as number) % 64 === 0 ? '✓ cache-line aligned' : '✗ misaligned'}</td>
          </tr>`).join('')}
      </table>

      <h2 style="color:#ffcc00;margin-top:24px">Cache Efficiency Analysis</h2>
      <table style="border-collapse:collapse;margin-top:8px">
        <tr><td style="color:#aaa;padding:2px 16px 2px 0">AoS: accessing bid across ${layout.capacity.toLocaleString()} rows</td>
            <td style="color:#ff6666">${layout.capacity.toLocaleString()} cache line loads</td></tr>
        <tr><td style="color:#aaa;padding:2px 16px 2px 0">SoA: accessing bid Float64Array</td>
            <td style="color:#00ff88">${Math.ceil(layout.capacity * 8 / 64).toLocaleString()} cache line loads</td></tr>
        <tr><td style="color:#aaa;padding:2px 16px 2px 0">Improvement</td>
            <td style="color:#ffcc00">${(layout.capacity / Math.ceil(layout.capacity * 8 / 64)).toFixed(1)}× fewer cache loads</td></tr>
      </table>

      <p style="margin-top:24px;color:#555">
        Open DevTools → Console → run the benchmark:<br>
        <span style="color:#00aaff">node src/benchmark/runner.mjs</span>
      </p>
    </div>`;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

function main(): void {
  checkCapabilities();

  // Instantiate our TradeBook. 10,000 rows = realistic for a full market depth view.
  // This is the ONE allocation we make for the data layer. Everything else is in-place.
  const book = new TradeBook(10_000);

  // Verify memory layout
  const layout = computeLayout(10_000);
  console.log('[TradeBook] initialized', {
    capacity:   layout.capacity,
    totalBytes: layout.totalBytes,
    memKB:      (layout.totalBytes / 1024).toFixed(2),
  });

  // Verify every offset is cache-line aligned
  const offsets = [
    layout.bidOffset, layout.askOffset, layout.lastOffset,
    layout.volumeOffset, layout.changeOffset, layout.changePctOffset,
    layout.highOffset, layout.lowOffset, layout.openOffset,
    layout.timestampOffset, layout.symbolIdOffset, layout.dirtyOffset,
  ];
  const misaligned = offsets.filter(o => o % 64 !== 0);
  if (misaligned.length > 0) {
    throw new Error(`BUG: Misaligned offsets detected: ${misaligned}`);
  }
  console.log('[TradeBook] all offsets cache-line aligned ✓');

  renderDiagnostics(book);
}

main();
