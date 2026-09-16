import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

/**
 * Real pointer-based drag-and-drop, shared by every game whose answer is
 * "pick this up and put it there" (DragMatch, Puzzle). Mouse and touch both
 * fire pointer events, so one implementation covers a teacher's laptop and a
 * child's iPad without a drag library.
 *
 * Dragging is additive, not a replacement: a pointer-down that never moves
 * past the threshold is reported as a tap instead, so the original
 * tap-to-select flow (proven reliable on a shared iPad) keeps working
 * alongside the new gesture.
 *
 * Tracking uses document-level listeners rather than `setPointerCapture` on
 * the dragged element: a captured element that gets a CSS transform/opacity
 * change on the very next frame (exactly what "lift this card" styling does)
 * has its capture silently released by the browser, which would otherwise
 * end the drag one frame after it starts.
 *
 * The ghost's position is written straight to the DOM (via `ghostRef`) on
 * every pointer move instead of going through React state — a setState per
 * mousemove means a full re-render of the whole game board on every pixel of
 * travel, which is exactly the kind of jank a four-year-old notices. React
 * state is only touched for the coarse, infrequent transitions: drag
 * started, the tap/drag threshold was crossed, the hovered drop zone
 * changed, drag ended.
 *
 * The drop zone under the pointer is chosen by *overlap*, not by the raw
 * pointer coordinate: the ghost is a full-size card, but a child's finger —
 * and this hook's own grab offset — can sit anywhere on it, including far
 * from its center. Hit-testing only the exact pointer pixel meant the big
 * card could visibly be sitting on top of a target and still not register,
 * unless that one pixel happened to line up. Comparing the ghost's whole
 * rectangle against each zone's rectangle means "the card is sitting on the
 * target" is what triggers the drop, which is what it looks like on screen.
 */
export interface DraggingItem {
  id: string;
  moved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** First-paint position, before any imperative move updates land. */
  x0: number;
  y0: number;
  /** Visual content for the floating ghost — an image fill, a background slice, etc. */
  ghostStyle?: CSSProperties;
}

const MOVE_THRESHOLD_PX = 6;
/** A zone must have at least this fraction of its own area covered by the
 * dragged card to count as "over it" — low enough to be forgiving, high
 * enough that a card barely grazing a neighbouring zone doesn't steal it. */
const MIN_OVERLAP_RATIO = 0.25;

function overlapArea(a: DOMRect | { left: number; top: number; width: number; height: number }, b: DOMRect) {
  const x = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const y = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? x * y : 0;
}

export function useDragDrop({
  disabled,
  onDrop,
  onTap,
}: {
  disabled: boolean;
  onDrop: (itemId: string, zoneId: string) => void;
  onTap?: (itemId: string) => void;
}) {
  const [dragging, setDragging] = useState<DraggingItem | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  // Mutable session state for the in-flight gesture — refs so the document
  // listeners (attached once per drag) always see the latest values without
  // needing to be torn down and re-attached on every state update.
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const movedRef = useRef(false);
  const overZoneRef = useRef<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const onDropRef = useRef(onDrop);
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onDropRef.current = onDrop;
    onTapRef.current = onTap;
  }, [onDrop, onTap]);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const start = startRef.current;
      if (!start || !activeIdRef.current) return;

      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX - offsetRef.current.x}px`;
        ghostRef.current.style.top = `${e.clientY - offsetRef.current.y}px`;
      }

      if (!movedRef.current) {
        const crossed = Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_THRESHOLD_PX;
        if (crossed) {
          movedRef.current = true;
          setDragging((cur) => (cur && cur.id === activeIdRef.current ? { ...cur, moved: true } : cur));
        } else {
          return;
        }
      }

      const ghostRect = {
        left: e.clientX - offsetRef.current.x,
        top: e.clientY - offsetRef.current.y,
        width: sizeRef.current.width,
        height: sizeRef.current.height,
      };
      let bestZone: string | null = null;
      let bestOverlap = 0;
      document.querySelectorAll<HTMLElement>('[data-drop-zone]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const overlap = overlapArea(ghostRect, rect);
        const zoneArea = rect.width * rect.height;
        if (overlap > bestOverlap && zoneArea > 0 && overlap / zoneArea >= MIN_OVERLAP_RATIO) {
          bestOverlap = overlap;
          bestZone = el.dataset.dropZone ?? null;
        }
      });
      if (bestZone !== overZoneRef.current) {
        overZoneRef.current = bestZone;
        setOverZone(bestZone);
      }
    };

    const finish = (cancelled: boolean) => {
      const id = activeIdRef.current;
      if (!id) return;
      const zoneId = overZoneRef.current;
      const wasMoved = movedRef.current;
      activeIdRef.current = null;
      startRef.current = null;
      movedRef.current = false;
      overZoneRef.current = null;
      setDragging(null);
      setOverZone(null);
      if (cancelled) return;
      if (wasMoved && zoneId) onDropRef.current(id, zoneId);
      else if (!wasMoved) onTapRef.current?.(id);
    };

    const handleUp = () => finish(false);
    const handleCancel = () => finish(true);

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleCancel);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleCancel);
    };
  }, []);

  const getDraggableProps = (id: string, ghostStyle?: CSSProperties) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      activeIdRef.current = id;
      startRef.current = { x: e.clientX, y: e.clientY };
      offsetRef.current = { x: offsetX, y: offsetY };
      sizeRef.current = { width: rect.width, height: rect.height };
      movedRef.current = false;
      overZoneRef.current = null;
      setOverZone(null);
      setDragging({
        id,
        moved: false,
        offsetX,
        offsetY,
        width: rect.width,
        height: rect.height,
        x0: e.clientX,
        y0: e.clientY,
        ghostStyle,
      });
    },
  });

  const getDropZoneProps = (zoneId: string) => ({
    'data-drop-zone': zoneId,
  });

  return { dragging, overZone, getDraggableProps, getDropZoneProps, ghostRef };
}
