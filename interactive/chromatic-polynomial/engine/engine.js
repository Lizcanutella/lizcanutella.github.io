// engine.js — JS face of the wasm engine (chromatic.wasm). Shared by worker.js and the
// Node parity check, so both exercise exactly the same calling code.
(function (root) {
  "use strict";
  const SELECTORS = ["none", "min_degree_sum", "max_degree_sum", "mindeg", "vorder", "monagan",
                     "learned", "mlp"];

  function wrap(Module, weights) {
    // Copies ints/doubles into wasm memory, calls `fn`, frees, returns the parsed JSON result.
    function call(fn, n, edges, selector, extra) {
      const sel = SELECTORS.indexOf(selector);
      if (sel < 0) throw new Error("unknown selector " + selector);
      const w = selector === "mlp" ? weights.mlp_flat : selector === "learned" ? weights.learned : [];
      const ep = Module._malloc(Math.max(1, edges.length * 8));
      const wp = Module._malloc(Math.max(1, w.length * 8));
      try {
        edges.forEach((e, i) => { Module.HEAP32[(ep >> 2) + 2 * i] = e[0]; Module.HEAP32[(ep >> 2) + 2 * i + 1] = e[1]; });
        w.forEach((x, i) => { Module.HEAPF64[(wp >> 3) + i] = x; });
        return JSON.parse(Module.UTF8ToString(fn(n, ep, edges.length, sel, wp, ...extra)));
      } finally {
        Module._free(ep); Module._free(wp);
      }
    }
    return {
      // -> {ok, poly: [decimal strings, k^0 upward], stats, trace} or {ok: false, error}
      compute: (n, edges, selector, useCache, budget) =>
        call(Module._crl_compute, n, edges, selector, [useCache ? 1 : 0, budget == null ? -1 : budget]),
      // -> per-edge policy scores, in the order of `edges` ([] for non-learned selectors)
      scores: (n, edges, selector) => call(Module._crl_scores, n, edges, selector, []),
    };
  }

  const api = { SELECTORS, wrap };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ChromaticEngine = api;
})(typeof self !== "undefined" ? self : this);
