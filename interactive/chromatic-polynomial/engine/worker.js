// worker.js — runs the wasm engine off the main thread. Cancelling a run = terminating this worker.
//   in:  {id, op: "compute", n, edges, selector, cache, budget} | {id, op: "scores", n, edges, selector}
//   out: {id, result} | {id, error} | {progress: [nodes, branches]} (posted from inside the engine)
importScripts("chromatic.js", "engine.js");

const ready = Promise.all([
  createEngine(),
  fetch("weights.json").then((r) => r.json()),
]).then(([Module, weights]) => ChromaticEngine.wrap(Module, weights));

onmessage = async (e) => {
  const { id, op, n, edges, selector, cache, budget } = e.data;
  try {
    const engine = await ready;
    if (op === "scores") return postMessage({ id, result: engine.scores(n, edges, selector) });
    const t0 = performance.now();
    const result = engine.compute(n, edges, selector, cache, budget);
    result.ms = performance.now() - t0;
    // columns become typed arrays and are transferred, not copied: a run can have 600k records
    const moved = [];
    if (result.ok) {
      const t = result.trace;
      for (const k of ["parent", "via", "kind", "n", "m", "u", "v"]) { t[k] = Int32Array.from(t[k]); moved.push(t[k].buffer); }
      for (const k of ["sb", "sn"]) { t[k] = Float64Array.from(t[k]); moved.push(t[k].buffer); }
    }
    postMessage({ id, result }, moved);
  } catch (err) {
    // a wasm trap (out of memory, stack overflow) lands here
    postMessage({ id, error: String(err && err.message || err) });
  }
};
