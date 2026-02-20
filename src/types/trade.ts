/**
 * The canonical trade row type. Used ONLY at system boundaries:
 * - Deserializing from wire format (WebSocket/SSE)
 * - Exposing data to external consumers
 *
 * This type NEVER appears in the hot path. Inside the engine,
 * data lives in TypedArrays (TradeBook). This object shape is
 * only instantiated for setup and teardown operations.
 *
 * If you find yourself creating TradeRow objects inside a loop
 * that runs 60 times per second — you have made an error.
 */
export interface TradeRow {
  readonly symbolId: number;   // Index into TradeBook.symbols[]
  readonly bid: number;
  readonly ask: number;
  readonly last: number;
  readonly volume: number;
  readonly change: number;
  readonly changePct: number;
  readonly high: number;
  readonly low: number;
  readonly open: number;
  readonly timestamp: number;  // ms since Unix epoch (Float64 — no precision loss until year 285M)
}

/**
 * A single field update. Used by the data worker to push
 * targeted updates without constructing full TradeRow objects.
 * Row index + field enum + new value = 24 bytes total.
 * This fits in L1 cache alongside many other updates.
 */
export const enum TradeField {
  Bid        = 0,
  Ask        = 1,
  Last       = 2,
  Volume     = 3,
  Change     = 4,
  ChangePct  = 5,
  High       = 6,
  Low        = 7,
  Open       = 8,
  Timestamp  = 9,
}

export const TRADE_FIELD_COUNT = 10 as const;
