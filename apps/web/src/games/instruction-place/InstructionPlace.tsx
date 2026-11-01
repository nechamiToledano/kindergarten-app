import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';
import { DragGhost } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'INSTRUCTION_PLACE' }>;
type Placement = { itemId: string; targetId: string };

const SUBMIT_DELAY_MS = 600;
/** Placed items are drawn at this share of the scene's width. */
const PLACED_SIZE_PCT = 22;

const art = (url: string): CSSProperties => ({
  backgroundImage: `url("${url}")`,
  backgroundSize: 'contain',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
});

/**
 * Spoken-instruction placement ("put the apple on the plate"). A scene picture
 * carries invisible drop targets; the loose items wait in a tray below. Drag an
 * item onto a target, or tap the item then tap the target (the tap flow is the
 * reliable fallback on a shared iPad). Once as many items are placed as there
 * are instructions the board submits itself after a beat — a three-year-old
 * shouldn't have to find a confirm button. Placed items stay put: the board
 * remounts for a retry after wrong feedback.
 */
export function InstructionPlace({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const done = placements.length >= config.steps.length;

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => onAnswer(placements), SUBMIT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [done, placements, onAnswer]);

  const place = (itemId: string, targetId: string) => {
    setPlacements((cur) => (cur.some((p) => p.itemId === itemId) ? cur : [...cur, { itemId, targetId }]));
    setSelected(null);
  };

  const { dragging, overZone, getDraggableProps, getDropZoneProps, ghostRef } = useDragDrop({
    disabled: disabled || done,
    onDrop: place,
    onTap: (id) => setSelected((cur) => (cur === id ? null : id)),
  });

  const placedIds = new Set(placements.map((p) => p.itemId));
  const trayItems = config.items.filter((i) => !placedIds.has(i.id));

  return (
    <div className="instruction-board">
      <div className="instruction-stage" style={art(config.sceneImageUrl)}>
        {config.targets.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-label={t.id}
            disabled={disabled || done || !selected}
            onClick={() => selected && place(selected, t.id)}
            className={`instruction-target${overZone === t.id ? ' is-drag-over' : ''}${selected ? ' is-armed' : ''}`}
            {...getDropZoneProps(t.id)}
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              width: `${t.width * 100}%`,
              height: `${t.height * 100}%`,
            }}
          />
        ))}
        {placements.map((p, n) => {
          const t = config.targets.find((x) => x.id === p.targetId);
          const item = config.items.find((i) => i.id === p.itemId);
          if (!t || !item) return null;
          const sameTargetBefore = placements.slice(0, n).filter((q) => q.targetId === p.targetId).length;
          const cx = (t.x + t.width / 2) * 100 + (sameTargetBefore % 2 ? 1 : -1) * sameTargetBefore * 4;
          const cy = (t.y + t.height / 2) * 100 - sameTargetBefore * 3;
          return (
            <span
              key={p.itemId}
              aria-hidden
              className="instruction-placed"
              style={{
                ...art(item.imageUrl),
                left: `${cx}%`,
                top: `${cy}%`,
                width: `${PLACED_SIZE_PCT}%`,
                height: `${PLACED_SIZE_PCT}%`,
              }}
            />
          );
        })}
      </div>

      <div className="instruction-tray">
        {trayItems.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label ?? item.id}
            disabled={disabled}
            className={`is-draggable instruction-item${selected === item.id ? ' is-selected' : ''}${
              dragging?.id === item.id && dragging.moved ? ' is-dragging' : ''
            }`}
            {...getDraggableProps(item.id, { ...art(item.imageUrl), boxShadow: 'none', filter: 'drop-shadow(0 18px 12px rgba(51, 64, 59, 0.4))' })}
            style={{ ...art(item.imageUrl), cursor: disabled ? 'default' : 'grab' }}
          />
        ))}
      </div>
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
    </div>
  );
}
