import { useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import type { GameComponentProps } from '../types';
import { DragGhost, SubmitButton } from '../ui';
import { useDragDrop } from '../useDragDrop';

type Config = Extract<GameConfig, { gameType: 'SYLLABLE_COUNT' }>;

/**
 * Spec (חלוקה להברות) — a word image on top, one empty square per syllable
 * below it, and one identical token per square plus a spare decoy. The child
 * drags a token into each square while saying the syllable aloud; the extra
 * token is meant to be left over. Answer: the list of slot ids that received
 * a token — which physical token landed where doesn't matter, only the count.
 */
export function SyllableCount({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [activeToken, setActiveToken] = useState<string | null>(null);

  const tokens = Array.from({ length: config.tokenCount }, (_, i) => `token-${i}`);
  const slots = Array.from({ length: config.slotCount }, (_, i) => `slot-${i}`);
  const filledBySlot = new Map(Object.entries(links).map(([token, slot]) => [slot, token]));

  const place = (tokenId: string, slotId: string) => {
    setLinks((cur) => {
      const next = { ...cur };
      // A slot holds one token, and a token occupies one slot — placing evicts either previous occupant.
      for (const [t, s] of Object.entries(next)) {
        if (s === slotId || t === tokenId) delete next[t];
      }
      next[tokenId] = slotId;
      return next;
    });
    setActiveToken(null);
  };

  const unlink = (tokenId: string) => {
    setLinks((cur) => {
      const next = { ...cur };
      delete next[tokenId];
      return next;
    });
  };

  const handleTap = (tokenId: string) => {
    if (disabled) return;
    if (links[tokenId]) unlink(tokenId);
    else setActiveToken((cur) => (cur === tokenId ? null : tokenId));
  };

  const { dragging, overZone, getDraggableProps, getDropZoneProps, ghostRef } = useDragDrop({
    disabled,
    onDrop: (tokenId, slotId) => place(tokenId, slotId),
    onTap: handleTap,
  });

  const rowStyle = { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, justifyContent: 'center' };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
      <img
        src={config.wordImageUrl}
        alt="המילה"
        style={{ inlineSize: 'clamp(120px, 24vw, 220px)', blockSize: 'clamp(120px, 24vw, 220px)', objectFit: 'cover', borderRadius: 16 }}
      />
      <div style={rowStyle}>
        {slots.map((slotId) => {
          const token = filledBySlot.get(slotId);
          const isOver = overZone === slotId;
          return (
            <button
              key={slotId}
              type="button"
              disabled={disabled || !activeToken}
              onClick={() => activeToken && place(activeToken, slotId)}
              className={`is-drop-target${isOver ? ' is-drag-over' : ''}`}
              {...getDropZoneProps(slotId)}
              style={{
                minInlineSize: MIN_TOUCH_TARGET_PX,
                minBlockSize: MIN_TOUCH_TARGET_PX,
                borderRadius: 16,
                border: `3px dashed ${token ? 'transparent' : 'var(--border, #d8d8d8)'}`,
                background: token ? 'var(--accent-2, #2f8f5b)' : 'var(--code-bg)',
                cursor: disabled ? 'default' : activeToken ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </div>
      <div style={rowStyle}>
        {tokens.map((tokenId) => {
          const isPlaced = Boolean(links[tokenId]);
          const isDraggingThis = dragging?.id === tokenId && dragging.moved;
          return (
            <button
              key={tokenId}
              type="button"
              disabled={disabled || isPlaced}
              className={`game-tap-pad is-draggable${isDraggingThis ? ' is-dragging' : ''}`}
              aria-pressed={activeToken === tokenId}
              {...getDraggableProps(tokenId)}
              style={{
                inlineSize: 'clamp(60px, 14vw, 90px)',
                blockSize: 'clamp(60px, 14vw, 90px)',
                minInlineSize: MIN_TOUCH_TARGET_PX,
                minBlockSize: MIN_TOUCH_TARGET_PX,
                borderRadius: '50%',
                background: 'var(--accent-2, #2f8f5b)',
                opacity: isPlaced ? 0.25 : 1,
                border: activeToken === tokenId ? '4px solid var(--accent, #d99a2e)' : 'none',
                cursor: disabled || isPlaced ? 'default' : 'pointer',
              }}
            />
          );
        })}
      </div>
      <DragGhost dragging={dragging} ghostRef={ghostRef} />
      <SubmitButton
        disabled={disabled || Object.keys(links).length === 0}
        onClick={() => onAnswer([...new Set(Object.values(links))])}
      >
        אישור
      </SubmitButton>
    </div>
  );
}
