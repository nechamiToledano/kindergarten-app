import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import { useAudioUnlock } from '../../shared/audio/AudioUnlockProvider';
import type { GameComponentProps } from '../types';
import { DragGhost, ImageCard, SubmitButton } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'DRAG_MATCH' }>;

/**
 * Spec §4.4 — match each source to its target. A source can be picked up and
 * dragged onto its target (real pointer drag, works for mouse and touch), or
 * tapped then tapped again — tap-to-pair stays as the reliable fallback on a
 * shared iPad. Answer: [{sourceId,targetId}], the shape the drag-match
 * plugin's `score` expects.
 */
export function DragMatch({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const { play } = useAudioUnlock();
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [justLanded, setJustLanded] = useState<string | null>(null);

  const place = (sourceId: string, targetId: string) => {
    setLinks((cur) => ({ ...cur, [sourceId]: targetId }));
    setActiveSource(null);
    setJustLanded(targetId);
    window.setTimeout(() => setJustLanded((cur) => (cur === targetId ? null : cur)), 260);
  };

  const unlink = (sourceId: string) => {
    setLinks((cur) => {
      const next = { ...cur };
      delete next[sourceId];
      return next;
    });
  };

  const handleTap = (sourceId: string) => {
    if (disabled) return;
    if (links[sourceId]) unlink(sourceId);
    else setActiveSource((cur) => (cur === sourceId ? null : sourceId));
  };

  const { dragging, overZone, getDraggableProps, getDropZoneProps, ghostRef } = useDragDrop({
    disabled,
    onDrop: (sourceId, targetId) => place(sourceId, targetId),
    onTap: handleTap,
  });

  const linkedTargetIds = new Set(Object.values(links));
  const rowStyle = { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, justifyContent: 'center' };
  const uniqueTargets = [
    ...new Map(config.pairs.map((p) => [p.targetId, p])).values(),
  ];

  return (
    <>
      <p style={{ textAlign: 'center', fontSize: 18, color: 'var(--muted-foreground, #6b7280)' }}>
        {activeSource ? 'עכשיו הקישו על ההתאמה הנכונה למטה 👇' : 'גררו תמונה למטה, או הקישו עליה כדי לבחור'}
      </p>
      <div style={{ display: 'grid', gap: '1.5rem', inlineSize: 'min(900px, 92vw)' }}>
        <div style={rowStyle}>
          {config.pairs.map((p) => {
            const isLinked = Boolean(links[p.sourceId]);
            const isDraggingThis = dragging?.id === p.sourceId && dragging.moved;
            const { onPointerDown, ...restDragProps } = getDraggableProps(p.sourceId, {
              backgroundImage: `url("${p.sourceImageUrl}")`,
              backgroundSize: 'cover',
            });
            return (
              <ImageCard
                key={p.sourceId}
                src={p.sourceImageUrl}
                label={p.sourceId}
                selected={activeSource === p.sourceId || isLinked}
                disabled={disabled}
                onClick={() => {}}
                className={`is-draggable${isDraggingThis ? ' is-dragging' : ''}`}
                dragProps={{
                  ...restDragProps,
                  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
                    if (!disabled && p.sourceAudioUrl) void play(p.sourceAudioUrl);
                    onPointerDown(e);
                  },
                }}
              />
            );
          })}
        </div>
        <div style={rowStyle}>
          {uniqueTargets.map((p) => {
            const isFilled = linkedTargetIds.has(p.targetId);
            const isOver = overZone === p.targetId;
            return (
              <button
                key={p.targetId}
                type="button"
                disabled={disabled || !activeSource}
                onClick={() => activeSource && place(activeSource, p.targetId)}
                className={`is-drop-target${isOver ? ' is-drag-over' : ''}${justLanded === p.targetId ? ' drop-landed' : ''}`}
                {...getDropZoneProps(p.targetId)}
                style={{
                  minInlineSize: MIN_TOUCH_TARGET_PX,
                  minBlockSize: MIN_TOUCH_TARGET_PX,
                  padding: 12,
                  borderRadius: 20,
                  border: `5px solid ${isFilled ? 'var(--accent-2)' : 'transparent'}`,
                  background: 'var(--code-bg)',
                  opacity: disabled && !isFilled ? 0.55 : 1,
                  cursor: disabled ? 'default' : activeSource ? 'pointer' : 'default',
                  position: 'relative',
                  transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms, background 150ms',
                }}
              >
                <img
                  src={p.targetImageUrl}
                  alt={p.targetId}
                  width={160}
                  height={160}
                  draggable={false}
                  style={{
                    display: 'block',
                    inlineSize: 'clamp(80px, 16vw, 160px)',
                    blockSize: 'clamp(80px, 16vw, 160px)',
                    objectFit: 'cover',
                    borderRadius: 12,
                    pointerEvents: 'none',
                  }}
                />
                {isFilled && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 6,
                      insetInlineEnd: 6,
                      background: 'var(--accent-2)',
                      color: '#fff',
                      borderRadius: '999px',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
      <SubmitButton
        disabled={disabled || Object.keys(links).length !== config.pairs.length}
        onClick={() => onAnswer(Object.entries(links).map(([sourceId, targetId]) => ({ sourceId, targetId })))}
      >
        אישור
      </SubmitButton>
    </>
  );
}
