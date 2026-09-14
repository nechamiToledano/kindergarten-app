import { useRef } from 'react';
import type { GameConfig } from '@kga/contracts';
import type { GameComponentProps } from '../types';

type Config = Extract<GameConfig, { gameType: 'HOTSPOT_IMAGE' }>;

/**
 * Spec §4.3 / §6 — tap a region of one image. Answer: {x,y} in normalised 0..1
 * space, which is exactly what the hotspot plugin's `score` hit-tests.
 */
export function HotspotImage({ config, disabled, onAnswer }: GameComponentProps<Config>) {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el || disabled) return;
    const rect = el.getBoundingClientRect();
    onAnswer({
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    });
  };

  return (
    <div
      ref={ref}
      onClick={(e) => handle(e.clientX, e.clientY)}
      style={{
        position: 'relative',
        inlineSize: 'min(720px, 88vw)',
        aspectRatio: '1 / 1',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'crosshair',
      }}
    >
      <img
        src={config.imageUrl}
        alt=""
        draggable={false}
        style={{ inlineSize: '100%', blockSize: '100%', objectFit: 'cover', display: 'block' }}
      />
      {config.targets.map((t) => (
        <span
          key={t.id}
          aria-hidden
          style={{
            position: 'absolute',
            insetInlineStart: `${t.x * 100}%`,
            insetBlockStart: `${t.y * 100}%`,
            inlineSize: `${t.width * 100}%`,
            blockSize: `${t.height * 100}%`,
            border: '2px dashed rgba(255,255,255,0.35)',
            borderRadius: 8,
          }}
        />
      ))}
    </div>
  );
}
