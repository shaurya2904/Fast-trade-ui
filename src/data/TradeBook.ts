/**
 * TradeBook — The Central Data Structure
 *
 * ARCHITECTURE: Struct of Arrays (SoA)
 *
 * WHY SoA, NOT AoS (Array of Structs)?
 *
 * Consider two layouts for N=10,000 trade rows:
 *
 * AoS layout (what you get with an array of objects):
 *   [ {bid,ask,last,vol,...}, {bid,ask,last,vol,...}, ... ]
 *   Memory: | row0_bid | row0_ask | ... | row0_ts | row1_bid | row1_ask | ...
 *   To access all bids: jump 85 bytes between each value → cache miss every time.
 *   For 10,000 rows: 10,000 cache line loads to read all bids.
 *
 * SoA layout (what we have):
 *   { bids: [...all bids...], asks: [...all asks...], ... }
 *   Memory: | bid0 | bid1 | bid2 | bid3 | bid4 | bid5 | bid6 | bid7 | ...
 *   To access all bids: sequential read of a contiguous Float64Array.
 *   A cache line holds 8 Float64 values. 10,000 bids = 1,250 cache line loads.
 *   That's an 8x reduction in cache pressure for this access pattern.
 *
 * The renderer iterates all rows once per frame. SoA is the only valid layout.
 *
 * MEMORY MODEL: Single Backing Buffer
 *
 * All 10 numeric field arrays are views into a SINGLE ArrayBuffer.
 * This has two advantages:
 *   1. One allocation at construction time. Zero allocations in the hot path.
 *   2. The entire buffer can be transferred to a Worker with a single
 *      postMessage transferable, or shared via SharedArrayBuffer.
 *
 * ALIGNMENT:
 *
 * Each Float64Array must start at an offset that is a multiple of 8 bytes
 * (Float64 alignment requirement). We additionally align each array to
 * 64-byte cache line boundaries. This prevents false sharing when arrays
 * are accessed from multiple threads (future SharedArrayBuffer use).
 *
 * For the dirty flags: Uint8Array aligned to 64 bytes. We use one byte
 * per row (not one bit) for two reasons:
 *   1. Atomic byte writes are safe. Atomic bit writes are not (bit-twiddling
 *      on a shared byte is a data race).
 *   2. Cache line containing 64 dirty flags can be checked with a single
 *      typed array read pass.
 */

import { type TradeRow } from '../types/trade.js';

const CACHE_LINE_BYTES = 64 as const;
const FLOAT64_BYTES    = 8 as const;
const INT32_BYTES      = 4 as const;

// Count of Float64 fields per row (bid, ask, last, vol, change, changePct, high, low, open, ts)
const FLOAT64_FIELD_COUNT = 10 as const;

/**
 * Round `offset` up to the nearest multiple of `alignment`.
 * Used to compute cache-line-aligned byte offsets within the backing buffer.
 *
 * Example: alignTo(65, 64) = 128
 *          alignTo(64, 64) = 64   (already aligned — no padding)
 */
function alignTo(offset: number, alignment: number): number {
  return Math.ceil(offset / alignment) * alignment;
}

/**
 * Compute all byte offsets for fields within the single backing ArrayBuffer.
 * Exposed as a readonly record so Workers can reconstruct views from the
 * same buffer without re-running layout logic.
 */
export interface BufferLayout {
  readonly capacity:       number;
  readonly totalBytes:     number;
  readonly bidOffset:      number;
  readonly askOffset:      number;
  readonly lastOffset:     number;
  readonly volumeOffset:   number;
  readonly changeOffset:   number;
  readonly changePctOffset:number;
  readonly highOffset:     number;
  readonly lowOffset:      number;
  readonly openOffset:     number;
  readonly timestampOffset:number;
  readonly symbolIdOffset: number;  // Int32Array
  readonly dirtyOffset:    number;  // Uint8Array
}

export function computeLayout(capacity: number): BufferLayout {
  // Float64 fields: each needs capacity * 8 bytes, aligned to 64 bytes
  const floatSize = alignTo(capacity * FLOAT64_BYTES, CACHE_LINE_BYTES);

  let offset = 0;
  const bidOffset       = offset; offset += floatSize;
  const askOffset       = offset; offset += floatSize;
  const lastOffset      = offset; offset += floatSize;
  const volumeOffset    = offset; offset += floatSize;
  const changeOffset    = offset; offset += floatSize;
  const changePctOffset = offset; offset += floatSize;
  const highOffset      = offset; offset += floatSize;
  const lowOffset       = offset; offset += floatSize;
  const openOffset      = offset; offset += floatSize;
  const timestampOffset = offset; offset += floatSize;

  // Int32 field (symbolId): capacity * 4 bytes, aligned to 64 bytes
  const int32Size       = alignTo(capacity * INT32_BYTES, CACHE_LINE_BYTES);
  const symbolIdOffset  = offset; offset += int32Size;

  // Uint8 field (dirty): capacity * 1 byte, aligned to 64 bytes
  const uint8Size       = alignTo(capacity, CACHE_LINE_BYTES);
  const dirtyOffset     = offset; offset += uint8Size;

  return {
    capacity,
    totalBytes:      offset,
    bidOffset,
    askOffset,
    lastOffset,
    volumeOffset,
    changeOffset,
    changePctOffset,
    highOffset,
    lowOffset,
    openOffset,
    timestampOffset,
    symbolIdOffset,
    dirtyOffset,
  };
}

/**
 * TradeBook — fixed-capacity, zero-allocation data store for trade rows.
 *
 * Construction is the ONLY time memory is allocated. After construction,
 * every operation is a typed array read/write — no heap allocations,
 * no GC pressure, no hidden class mutations.
 *
 * Usage:
 *   const book = new TradeBook(10_000);
 *   book.setRow(0, tradeData);       // O(1), no allocation
 *   book.updateBid(0, 100.50);       // O(1), no allocation — single float write
 *   book.markDirty(0);               // O(1), flag this row for redraw
 *   book.bid[0]                      // Direct typed array access in renderer
 */
export class TradeBook {
  readonly capacity: number;
  readonly layout:   BufferLayout;

  // The single backing buffer. Expose it so it can be transferred to Workers.
  readonly buffer: ArrayBuffer;

  // Typed array views into the backing buffer.
  // These are VIEWS — they do not own memory. Zero-cost to create.
  readonly bid:       Float64Array;
  readonly ask:       Float64Array;
  readonly last:      Float64Array;
  readonly volume:    Float64Array;
  readonly change:    Float64Array;
  readonly changePct: Float64Array;
  readonly high:      Float64Array;
  readonly low:       Float64Array;
  readonly open:      Float64Array;
  readonly timestamp: Float64Array;
  readonly symbolId:  Int32Array;
  readonly dirty:     Uint8Array;

  // Symbol string table. Symbols are strings — cannot go in typed arrays.
  // Indexed by symbolId. This array is NOT part of the hot path:
  // the renderer uses symbolId (Int32) to look up text to draw.
  readonly symbols: string[];

  // Tracks how many rows are actually populated (0 to capacity).
  rowCount: number = 0;

  constructor(capacity: number) {
    if (capacity <= 0 || !Number.isInteger(capacity)) {
      throw new RangeError(`TradeBook capacity must be a positive integer, got ${capacity}`);
    }

    this.capacity = capacity;
    this.layout   = computeLayout(capacity);
    this.buffer   = new ArrayBuffer(this.layout.totalBytes);
    this.symbols  = [];

    const l = this.layout;
    this.bid       = new Float64Array(this.buffer, l.bidOffset,       capacity);
    this.ask       = new Float64Array(this.buffer, l.askOffset,       capacity);
    this.last      = new Float64Array(this.buffer, l.lastOffset,      capacity);
    this.volume    = new Float64Array(this.buffer, l.volumeOffset,    capacity);
    this.change    = new Float64Array(this.buffer, l.changeOffset,    capacity);
    this.changePct = new Float64Array(this.buffer, l.changePctOffset, capacity);
    this.high      = new Float64Array(this.buffer, l.highOffset,      capacity);
    this.low       = new Float64Array(this.buffer, l.lowOffset,       capacity);
    this.open      = new Float64Array(this.buffer, l.openOffset,      capacity);
    this.timestamp = new Float64Array(this.buffer, l.timestampOffset, capacity);
    this.symbolId  = new Int32Array( this.buffer, l.symbolIdOffset,  capacity);
    this.dirty     = new Uint8Array( this.buffer, l.dirtyOffset,     capacity);
  }

  /**
   * Add a new symbol to the string table. Returns its symbolId.
   * Called during initial data load, NOT in the hot path.
   */
  registerSymbol(symbol: string): number {
    const id = this.symbols.length;
    this.symbols.push(symbol);
    return id;
  }

  /**
   * Write a complete row. Used for initial population only.
   * In the live update path, use the targeted field-update methods below.
   */
  setRow(rowIndex: number, row: TradeRow): void {
    this.bid[rowIndex]       = row.bid;
    this.ask[rowIndex]       = row.ask;
    this.last[rowIndex]      = row.last;
    this.volume[rowIndex]    = row.volume;
    this.change[rowIndex]    = row.change;
    this.changePct[rowIndex] = row.changePct;
    this.high[rowIndex]      = row.high;
    this.low[rowIndex]       = row.low;
    this.open[rowIndex]      = row.open;
    this.timestamp[rowIndex] = row.timestamp;
    this.symbolId[rowIndex]  = row.symbolId;
    this.dirty[rowIndex]     = 1;
  }

  /**
   * Targeted field updates — used in the live hot path.
   * Each is a single typed array write. No allocation. No object creation.
   */
  updateBid(rowIndex: number, value: number): void {
    this.bid[rowIndex]   = value;
    this.dirty[rowIndex] = 1;
  }

  updateAsk(rowIndex: number, value: number): void {
    this.ask[rowIndex]   = value;
    this.dirty[rowIndex] = 1;
  }

  updateLast(rowIndex: number, value: number): void {
    this.last[rowIndex]  = value;
    this.dirty[rowIndex] = 1;
  }

  updateBidAsk(rowIndex: number, bid: number, ask: number): void {
    this.bid[rowIndex]   = bid;
    this.ask[rowIndex]   = ask;
    this.dirty[rowIndex] = 1;
  }

  /** Mark a row as needing redraw. */
  markDirty(rowIndex: number): void {
    this.dirty[rowIndex] = 1;
  }

  /** Clear dirty flag after the renderer has drawn this row. */
  clearDirty(rowIndex: number): void {
    this.dirty[rowIndex] = 0;
  }

  /** Clear ALL dirty flags. Called by renderer after each frame. */
  clearAllDirty(): void {
    // Uint8Array.fill is implemented as a memset in V8 — this is a single
    // hardware instruction sequence, not a JavaScript loop.
    this.dirty.fill(0);
  }

  /**
   * How many bytes does this TradeBook consume?
   * For diagnostic/logging at init time — NOT called in the hot path.
   */
  get memorySizeKB(): number {
    return this.layout.totalBytes / 1024;
  }
}
