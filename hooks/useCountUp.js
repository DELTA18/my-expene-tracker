import { useEffect, useRef, useState } from "react";

// Animates a displayed number toward `value` instead of snapping to it —
// tracks the actual mid-flight value (not just the last target) so a second
// change arriving before the first animation finishes continues smoothly
// rather than jumping or restarting.
export function useCountUp(value, duration = 500) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = displayRef.current;
    const to = value;
    if (Math.abs(from - to) < 0.005) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}
