// Start on the first animation timestamp: the first rAF can precede performance.now().
export const frameLoop = (duration: number, signal: AbortSignal, onFrame: (progress: number) => void) => new Promise<boolean>((resolve, reject) => {
  if (signal.aborted) return resolve(false);
  let start: number | undefined;
  let frame = 0;
  const cleanup = () => { cancelAnimationFrame(frame); signal.removeEventListener("abort", onAbort); };
  const onAbort = () => { cleanup(); resolve(false); };
  const tick = (now: number) => {
    if (signal.aborted) return onAbort();
    start ??= now;
    const progress = Math.max(0, Math.min(1, (now - start) / Math.max(1, duration)));
    try { onFrame(progress); } catch (error) { cleanup(); reject(error); return; }
    if (progress >= 1) { cleanup(); resolve(true); }
    else frame = requestAnimationFrame(tick);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  frame = requestAnimationFrame(tick);
});

