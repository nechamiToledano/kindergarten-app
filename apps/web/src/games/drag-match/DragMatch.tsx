import { useState } from 'react';
import type { GameConfig } from '@kga/contracts';
import { MIN_TOUCH_TARGET_PX } from '@kga/ui';
import type { GameComponentProps } from '../types';
import { ImageCard, SubmitButton } from '../ui';

type Config = Extract<GameConfig, { gameType: 'DRAG_MATCH' }>;

/**
 * Spec §4.4 — match each source to its target. On a shared iPad, tap-to-pair is
 * more reliable than HTML drag: tap a source, then tap a target. Answer:
 * [{sourceId,targetId}], the shape the drag-match plugin's `score` expects.
 */
export function DragMatch({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  const link = (targetId: string) => {
    if (!activeSource || disabled) return;
    setLinks((cur) => ({ ...cur, [activeSource]: targetId }));
    setActiveSource(null);
  };

  const rowStyle = { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, justifyContent: 'center' };

  return (
    <>
      <div style={{ display: 'grid', gap: '1.5rem', inlineSize: 'min(900px, 92vw)' }}>
        <div style={rowStyle}>
          {config.pairs.map((p) => (
            <ImageCard
              key={p.sourceId}
              src={p.sourceImageUrl}
              label={links[p.sourceId] ? `→ ${links[p.sourceId]}` : p.sourceId}
              selected={activeSource === p.sourceId}
              disabled={disabled}
              onClick={() => setActiveSource(p.sourceId)}
            />
          ))}
        </div>
        <div style={rowStyle}>
          {config.pairs.map((p) => (
            <button
              key={p.targetId}
              type="button"
              disabled={disabled || !activeSource}
              onClick={() => link(p.targetId)}
              style={{
                minInlineSize: MIN_TOUCH_TARGET_PX,
                minBlockSize: MIN_TOUCH_TARGET_PX,
                padding: 12,
                borderRadius: 20,
                border: '5px solid transparent',
                background: 'var(--code-bg)',
                cursor: disabled || !activeSource ? 'default' : 'pointer',
              }}
            >
              <img src={p.targetImageUrl} alt={p.targetId} width={160} height={160} style={{ display: 'block', borderRadius: 12 }} />
              <div style={{ marginBlockStart: 8, fontWeight: 600 }}>{p.targetId}</div>
            </button>
          ))}
        </div>
      </div>
      <SubmitButton
        disabled={disabled || Object.keys(links).length !== config.pairs.length}
        onClick={() => onAnswer(Object.entries(links).map(([sourceId, targetId]) => ({ sourceId, targetId })))}
      >
        אישור
      </SubmitButton>
    </>
  );
}
