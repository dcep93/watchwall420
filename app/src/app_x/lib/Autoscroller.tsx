import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const PERIOD_MS = 10;
const EDGE_SLEEP_MS = 2500;

export default function Autoscroller(props: {
  speed: number;
  className?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fakeState = {
      offset: 0,
      sleeping: false,
      edgeTimeoutId: 0 as number | undefined,
      tickTimeoutId: 0 as number | undefined,
    };

    const helper = () => {
      const element = containerRef.current;
      if (!element) return;

      const scrollableAmount = element.scrollHeight - element.clientHeight;
      const currentlyScrolled = element.scrollTop;

      if (fakeState.sleeping) {
        return;
      }

      if (Math.abs(fakeState.offset - currentlyScrolled) > 10) {
        fakeState.sleeping = true;
        fakeState.edgeTimeoutId = window.setTimeout(() => {
          const latestElement = containerRef.current;
          if (!latestElement) return;

          if (scrollableAmount - currentlyScrolled < 5) {
            fakeState.offset = 0;
            latestElement.scrollTo({ top: 0 });
            fakeState.edgeTimeoutId = window.setTimeout(() => {
              fakeState.sleeping = false;
            }, EDGE_SLEEP_MS);
            return;
          }

          fakeState.offset = currentlyScrolled;
          fakeState.sleeping = false;
        }, EDGE_SLEEP_MS);
        return;
      }

      fakeState.offset += (props.speed * scrollableAmount * PERIOD_MS) / 1000;
      element.scrollTo({ top: Math.ceil(fakeState.offset) });
    };

    const tick = () => {
      helper();
      fakeState.tickTimeoutId = window.setTimeout(tick, PERIOD_MS);
    };

    tick();

    return () => {
      if (fakeState.edgeTimeoutId) {
        window.clearTimeout(fakeState.edgeTimeoutId);
      }
      if (fakeState.tickTimeoutId) {
        window.clearTimeout(fakeState.tickTimeoutId);
      }
    };
  }, [props.speed]);

  return (
    <div ref={containerRef} className={props.className}>
      {props.children}
    </div>
  );
}
