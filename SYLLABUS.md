# HIGH-PERFORMANCE HIGH-FREQUENCY TRADING UI — SYLLABUS

**Philosophy:** Grothendieck's rigor. Torvalds' pragmatism. Carmack's cycle-counting.
Feynman's first principles. 3Blue1Brown's intuition. No vagueness. No hand-waving.
Every claim measurable. Every design provable. Every abstraction earns its place.

**Project:** The most performant browser-based trading grid ever constructed.

**Progression Rule:** You do not advance until the current module is mastered:
1. Explain the concept from first principles, no notes
2. Implement it correctly in the project
3. Prove performance with profiler data
4. Code review: no vagueness, no premature abstraction, no unnecessary indirection

---

## MODULE 0 — THE PHYSICS OF LATENCY

### 0.1 — The Memory Hierarchy: The Fundamental Constraint

L1 (~1ns, 64KB) → L2 (~4ns, 256KB) → L3 (~40ns, 8MB) → RAM (~100ns).
A cache miss at 3GHz = 300 wasted cycles. Every performance problem traces here.

**Reading:**
- Ulrich Drepper — *What Every Programmer Should Know About Memory* (2007)
  https://people.freebsd.org/~lstewart/articles/cpumemory.pdf
  Sections 2, 3, 6. The single most important performance document ever written.
- Igor Ostrovsky — *Gallery of Processor Cache Effects*
  https://igoro.com/archive/gallery-of-processor-cache-effects/
- Jeff Dean / Colin Scott — *Latency Numbers Every Programmer Should Know*
  https://colin-scott.github.io/personal_website/research/interactive_latency.html

### 0.2 — What a "Frame" Is Physically

60Hz = 16.67ms. 144Hz = 6.94ms. Hard vsync deadline. Miss it = dropped frame.

**Reading:**
- Google — *Rendering Performance*
  https://web.dev/articles/rendering-performance
- Jake Archibald — *requestAnimationFrame timing*
  https://jakearchibald.com/2021/request-animation-frame-and-when-it-fires/

### 0.3 — The Browser Rendering Pipeline

JavaScript → Style → Layout → Paint → Composite. Each stage has a cost.
Layout is O(n) tree walk. Only Composite (GPU texture ops) is cheap.

**Reading:**
- Tali Garsiel & Paul Irish — *How Browsers Work*
  https://web.dev/articles/howbrowserswork
- CSS Triggers — per-property Layout/Paint/Composite reference
  https://csstriggers.com/
- Paul Lewis — *Pixels Are Expensive*
  https://aerotwist.com/blog/pixels-are-expensive/

---

## MODULE 1 — BROWSER INTERNALS: THE V8 ENGINE

### 1.1 — Hidden Classes and Inline Caches

V8 assigns hidden classes (Maps) to objects. Mutating shape = deoptimization.
Monomorphic > Polymorphic > Megamorphic. Always monomorphic in hot paths.

**Reading:**
- Mathias Bynens (V8 team) — *JavaScript Engine Shapes and Inline Caches*
  https://mathiasbynens.be/notes/shapes-ics
- V8 Blog — *Fast Properties in V8*
  https://v8.dev/blog/fast-properties
- Vyacheslav Egorov — *What's Up With Monomorphism?*
  https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html

### 1.2 — JIT Compilation: Turbofan

Ignition (interpreter) → Sparkplug → Maglev → Turbofan (optimizing).
Turbofan generates near-native code. Deoptimization falls to interpreter.

**Reading:**
- V8 Blog — *Launching Ignition and TurboFan*
  https://v8.dev/blog/launching-ignition-and-turbofan
- V8 Blog — *Maglev: V8's Fastest Optimizing JIT*
  https://v8.dev/blog/maglev
- Jay Conrod — *A Tour of V8: TurboFan*
  https://jayconrod.com/posts/54/a-tour-of-v8--turbofan

### 1.3 — Garbage Collection: The Silent Frame Killer

V8 Orinoco: Scavenge (young gen ~1ms), Mark-Compact (old gen ~5-50ms).
Only way to avoid GC jank = zero allocation in the hot path.

**Reading:**
- V8 Blog — *Trash Talk: The Orinoco Garbage Collector*
  https://v8.dev/blog/trash-talk
- V8 Blog — *Concurrent Marking*
  https://v8.dev/blog/concurrent-marking
- Chrome DevTools — *Allocation Sampling*
  https://developer.chrome.com/docs/devtools/memory/allocation-sampling

### 1.4 — TypedArrays vs Regular Arrays

`Float64Array` = contiguous memory view. `Array<number>` = V8 JSArray (21 element kinds).
Different universes for cache behavior and GC pressure.

**Reading:**
- V8 Blog — *Elements Kinds in V8*
  https://v8.dev/blog/elements-kinds
- MDN — *JavaScript Typed Arrays*
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays

---

## MODULE 2 — THE RENDERING ARCHITECTURE

### 2.1 — DOM as a Scene Graph

Every DOM mutation crosses JS↔C++ boundary. Layout thrashing = interleaved reads/writes.

**Reading:**
- Wilson Page — *Preventing Layout Thrashing*
  https://blog.wilsonpage.co.uk/preventing-layout-thrashing/
- Paul Irish — *What Forces Layout/Reflow* (gist)
  https://gist.github.com/paulirish/5d52fb081b3570c81e3a
- FastDOM source (~150 lines) — study the read/write batching pattern
  https://github.com/nicktho/fastdom

### 2.2 — Virtual DOM: Correct but Suboptimal

React reconciliation is O(n) diff. For 10k rows at 60fps it creates millions of
ephemeral VDOM objects per second — all garbage collected.

**Reading:**
- Rich Harris — *Virtual DOM is Pure Overhead*
  https://svelte.dev/blog/virtual-dom-is-pure-overhead
- Andrew Clark — *React Fiber Architecture*
  https://github.com/acdlite/react-fiber-architecture
- SolidJS — *Fine-Grained Reactivity Comparison*
  https://www.solidjs.com/guides/comparison

### 2.3 — Canvas 2D: Direct Pixel Control

No layout, no style, no reflow. You own every pixel.
`fillText()` is the bottleneck at scale.

**Reading:**
- MDN — *Optimizing Canvas*
  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN — *OffscreenCanvas* (render in a Worker)
  https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- HTML5Rocks — *High Performance Canvas*
  https://web.dev/articles/canvas-performance

### 2.4 — WebGL/WebGPU: GPU-Accelerated Rendering

When Canvas 2D bottlenecks (>100k cells), move to GPU.
Text rendering on GPU requires glyph atlases and signed distance fields.

**Reading:**
- webgpufundamentals.org — the best WebGPU tutorial series
  https://webgpufundamentals.org/
- Google — *Tour of WGSL* (interactive)
  https://google.github.io/tour-of-wgsl/
- Valve — *SDF Text Rendering* (SIGGRAPH 2007)
  https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
- Alain Galvan — *Raw WebGPU*
  https://alain.xyz/blog/raw-webgpu

### 2.5 — CSS Transforms vs Layout Properties

`transform` → Composite only (~0.1ms). `left` → Layout+Paint+Composite (~3-10ms).
Only `transform` and `opacity` skip Layout and Paint.

**Reading:**
- Paul Lewis — *Stick to Compositor-Only Properties*
  https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count

---

## MODULE 3 — WEB WORKERS: TRUE PARALLELISM

### 3.1 — The Event Loop

Call stack → microtask queue → macrotask queue → render.
`Promise.then()` (microtask) before `setTimeout(fn,0)` (macrotask).

**Reading:**
- Philip Roberts — *What the heck is the event loop?* (JSConf 2014, 26 min)
  https://www.youtube.com/watch?v=8aGhZQkoFbQ
- Jake Archibald — *In The Loop* (JSConf Asia 2018)
  https://www.youtube.com/watch?v=cCOL7MC4Pl0
- Jake Archibald — *Tasks, Microtasks, Queues and Schedules* (interactive)
  https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/

### 3.2 — Message Passing vs Shared Memory

`postMessage` serializes via structured clone — O(n). For 10k rows at 60fps this is fatal.
Transferable ArrayBuffers are zero-copy but sender loses access.

**Reading:**
- Surma (Chrome team) — *Is postMessage Slow?*
  https://surma.dev/things/is-postmessage-slow/
- MDN — *Structured Clone Algorithm*
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
- MDN — *Transferable Objects*
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects

### 3.3 — Transferable Objects: Zero-Copy

ArrayBuffer transfer = ownership move, zero bytes copied. Sender's buffer detaches.

**Reading:**
- Chrome Developers — *Transferable Objects Lightning Fast*
  https://developer.chrome.com/blog/transferable-objects-lightning-fast/
- Google Chrome Labs — *Comlink* (RPC over postMessage, ~500 lines)
  https://github.com/nicktho/comlink

### 3.4 — Worker Pool Architecture

Optimal pool size ≈ `navigator.hardwareConcurrency`. Thread creation costs ~5ms.

**Reading:**
- MDN — *navigator.hardwareConcurrency*
  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency

---

## MODULE 4 — SharedArrayBuffer AND ATOMICS

### 4.1 — The Memory Model

CPUs reorder memory operations. Writes in thread A may not be visible in order from thread B.
`Atomics` provides ordering guarantees. Without them, shared memory = undefined behavior.

**Reading:**
- Jeff Preshing — *A Crash Course in Memory Ordering* (4-part series)
  https://preshing.com/20120930/weak-vs-strong-memory-models/
- Dr. Axel Rauschmayer — *Shared Memory and Atomics*
  https://exploringjs.com/es2016-es2017/ch_shared-array-buffer.html
- MDN — *SharedArrayBuffer*
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- Sorin, Hill, Wood — *A Primer on Memory Consistency and Cache Coherence* (2011)
  https://pages.cs.wisc.edu/~markhill/papers/primer2020_2nd_edition.pdf
  Chapters 1-3, 5. The textbook.

### 4.2 — Lock-Free Data Structures

Locks = context switches. Context switches in hot path = unacceptable.
Lock-free uses `Atomics.compareExchange` (CAS) for thread-safe mutation without blocking.

**Reading:**
- Herb Sutter — *Lock-Free Programming* (CppCon 2014)
  https://www.youtube.com/watch?v=c1gO9aB9nbs
- Herlihy & Shavit — *The Art of Multiprocessor Programming*
  Chapters 3, 5, 10, 11. The bible of lock-free programming.
- Dmitry Vyukov — *1024cores: Lock-Free Algorithms*
  https://www.1024cores.net/home/lock-free-algorithms

### 4.3 — The Ring Buffer

Fixed memory. No allocation. O(1) read/write. Cache-friendly sequential access.
SPSC ring buffer = the foundational data structure of every HFT system.

**Reading:**
- LMAX Exchange — *The Disruptor Technical Paper*
  https://lmax-exchange.github.io/disruptor/disruptor.html
  6 million transactions/sec. Read the full paper.
- Martin Thompson — *Mechanical Sympathy Blog*
  https://mechanical-sympathy.blogspot.com/
- Martin Fowler — *The LMAX Architecture*
  https://martinfowler.com/articles/lmax.html

### 4.4 — Cache Lines and False Sharing

Cache line = 64 bytes. If producer and consumer share a cache line,
MESI protocol constantly invalidates. Performance collapses.

**Reading:**
- Herb Sutter — *Effective Concurrency: False Sharing*
  https://herbsutter.com/2009/02/25/effective-concurrency/
- Joe Mario — *perf c2c: detecting false sharing*
  https://joemario.github.io/blog/2016/09/01/c2c-blog/

---

## MODULE 5 — WEBSOCKET: THE DATA PIPELINE

### 5.1 — WebSocket Protocol

TCP + framing layer. 2-14 bytes frame overhead. At 1000 msg/sec, overhead matters.

**Reading:**
- RFC 6455 — *The WebSocket Protocol* (sections 1, 5, 7)
  https://datatracker.ietf.org/doc/html/rfc6455
- Ilya Grigorik — *High Performance Browser Networking: WebSocket chapter*
  https://hpbn.co/websocket/

### 5.2 — Binary Protocol Design

JSON parse at 1000 msg/sec = ~5-10ms/frame. Binary (DataView) = ~0.1ms/frame.

**Reading:**
- Google — *FlatBuffers* (zero-copy deserialization)
  https://flatbuffers.dev/
- Google — *Protocol Buffers Encoding Guide*
  https://protobuf.dev/programming-guides/encoding/
- Kenton Varda — *Cap'n Proto* (zero-copy, no encode/decode)
  https://capnproto.org/

### 5.3 — Backpressure

When data arrives faster than render, snapshot latest state per symbol. Drop intermediates.

**Reading:**
- Martin Fowler — *LMAX Architecture* (backpressure in trading)
  https://martinfowler.com/articles/lmax.html
- Node.js docs — *Backpressuring in Streams*
  https://nodejs.org/en/learn/modules/backpressuring-in-streams

### 5.4 — Server-Sent Events vs WebSocket

SSE: HTTP/2 multiplexed, unidirectional, auto-reconnect.
WebSocket: TCP, bidirectional, manual reconnect.
For read-heavy market feeds, SSE on HTTP/2 can outperform WebSocket.

**Reading:**
- MDN — *Server-Sent Events*
  https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Smashing Magazine — *SSE vs WebSocket under HTTP/2*
  https://www.smashingmagazine.com/2018/02/sse-websockets-data-flow-http2/

---

## MODULE 6 — SERVICE WORKERS

### 6.1 — Fetch Interception

Service Workers sit between browser and network. Every fetch interceptable.

**Reading:**
- Jake Archibald — *The Service Worker Lifecycle*
  https://web.dev/articles/service-worker-lifecycle

### 6.2 — Cache Strategies

Cache-First, Network-First, Stale-While-Revalidate. Each has different
correctness and performance properties.

**Reading:**
- Jake Archibald — *The Offline Cookbook*
  https://web.dev/articles/offline-cookbook
- Google — *Workbox*
  https://developer.chrome.com/docs/workbox

### 6.3 — Background Sync

Queue failed operations for retry. Order entry must never silently fail.

**Reading:**
- MDN — *Background Synchronization API*
  https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API

---

## MODULE 7 — WEBASSEMBLY AND RUST

### 7.1 — The Wasm Memory Model

Stack machine + linear memory (flat ArrayBuffer). No GC. No hidden classes.
Predictable, constant-time execution. Can share memory via SharedArrayBuffer.

**Reading:**
- Lin Clark — *A Cartoon Intro to WebAssembly* (Mozilla)
  https://hacks.mozilla.org/2017/02/a-cartoon-intro-to-webassembly/
- Rust+Wasm Working Group — *Rust and WebAssembly Book*
  https://rustwasm.github.io/docs/book/

### 7.2 — Rust's Zero-Cost Abstractions

Ownership + Borrowing + Lifetimes = memory safety without GC.
Iterators compile to same assembly as hand-written C loops.

**Reading:**
- *The Rust Programming Language* — Chapters 4, 10, 13, 16
  https://doc.rust-lang.org/book/
- Nicholas Nethercote — *The Rust Performance Book*
  https://nnethercote.github.io/perf-book/

### 7.3 — SIMD in Wasm

Process 4 floats in one instruction. 4x throughput for bulk calculations.

**Reading:**
- V8 Blog — *WebAssembly SIMD*
  https://v8.dev/features/simd

### 7.4 — The FFI Boundary

Every JS↔Wasm call costs ~10-50ns. Pass buffer pointers, not values. Process in bulk.

**Reading:**
- Rust+Wasm — *wasm-bindgen guide*
  https://rustwasm.github.io/docs/wasm-bindgen/

---

## MODULE 8 — WebGPU: GPU COMPUTE

### 8.1 — GPU Memory Model

GPU memory hierarchy (registers → shared → L2 → VRAM). CPU↔GPU via PCIe.
Minimize transfers. Upload once, compute many.

**Reading:**
- NVIDIA — *GPU Architecture Background*
  https://docs.nvidia.com/deeplearning/performance/dl-performance-gpu-background/index.html
- NVIDIA — *Life of a Triangle*
  https://developer.nvidia.com/content/life-triangle-nvidias-logical-pipeline

### 8.2 — Compute Shaders

General-purpose parallel computation. Workgroups, invocations, shared memory.

**Reading:**
- webgpufundamentals — *Compute Shaders*
  https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html
- W3C — *WGSL Specification*
  https://www.w3.org/TR/WGSL/

### 8.3 — GPU Text Rendering

Glyph atlas + instanced rendering = one draw call for all text.
SDF fonts scale to any size without re-rasterization.

**Reading:**
- Valve — *SDF Text* (SIGGRAPH 2007)
  https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
- Chlumsky — *Multi-channel SDF Generator*
  https://github.com/Chlumsky/msdfgen

---

## MODULE 9 — THE TRADING GRID: INTEGRATION

### 9.1 — Architecture

```
[Market Data] → WebSocket (binary) → [Data Worker]
       ↕ SharedArrayBuffer Ring Buffer ↕
[Compute Worker / Rust-Wasm]  →  [Main Thread: Renderer]
                                        ↓
                               [Canvas / WebGPU] → 60fps
```

**Reading:**
- FINOS/J.P. Morgan — *Perspective* (streaming Wasm+Workers viz engine)
  https://perspective.finos.org/
- AG Grid — *Row Virtualization*
  https://www.ag-grid.com/javascript-data-grid/dom-virtualisation/

### 9.2 — Virtual Scrolling

Only render visible rows. 100k rows, 50 visible = 99,950 never rendered.

**Reading:**
- Google — *Virtualize Long Lists*
  https://web.dev/articles/virtualize-long-lists-react-window

### 9.3 — Dirty-Flag Rendering

One dirty bit per row. Only redraw changed rows. Stable market = zero redraws.

**Reading:**
- Robert Nystrom — *Game Programming Patterns: Dirty Flag*
  https://gameprogrammingpatterns.com/dirty-flag.html
- Casey Muratori — *Immediate Mode GUI*
  https://caseymuratori.com/blog_0001

### 9.4 — Input Handling

Debounce, batch, never block render. Sort 100k rows off-thread.

**Reading:**
- Chrome — *isInputPending()*
  https://developer.chrome.com/docs/capabilities/web-apis/isinputpending

---

## MODULE 10 — MEASUREMENT AND PROFILING

### 10.1 — The Performance API

`performance.now()` — 5μs resolution. `mark()` / `measure()` — named spans in DevTools.

**Reading:**
- MDN — *Performance API*
  https://developer.mozilla.org/en-US/docs/Web/API/Performance_API
- MDN — *User Timing API*
  https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/User_timing

### 10.2 — Flame Graphs

Call stack over time. Width = duration. Find the widest bars.

**Reading:**
- Brendan Gregg — *Flame Graphs* (the inventor)
  https://www.brendangregg.com/flamegraphs.html
- Chrome DevTools — *Performance Panel*
  https://developer.chrome.com/docs/devtools/performance

### 10.3 — Long Task Detection

Detect tasks >50ms automatically. Log. Alert. Fix.

**Reading:**
- Google — *Web Vitals* (INP, LCP, CLS)
  https://web.dev/articles/vitals

### 10.4 — Benchmarking Methodology

Warmup for JIT. >100 samples. Control GC. Prevent dead code elimination.

**Reading:**
- Vyacheslav Egorov — *How Not to Benchmark JavaScript*
  https://mrale.ph/blog/2012/12/15/microbenchmarks-fairy-tale.html
- Curtsinger & Berger — *Stabilizer: Statistically Sound Perf Evaluation* (2013)
  https://emeryberger.com/research/stabilizer/

---

## APPENDIX — FOUNDATIONAL TEXTS

| Book | Relevance |
|------|-----------|
| Bryant & O'Hallaron — *CS:APP* (Ch 5-6) | Memory hierarchy, optimization |
| Hennessy & Patterson — *Computer Architecture* | Cache design, hardware |
| Ilya Grigorik — *High Performance Browser Networking* (hpbn.co) | TCP, HTTP/2, WebSocket |
| Jason Gregory — *Game Engine Architecture* | Real-time loops, memory |
| Herlihy & Shavit — *Art of Multiprocessor Programming* | Lock-free algorithms |
| David Flanagan — *JavaScript: The Definitive Guide* | TypedArrays, language |
