import { useRef, useState } from 'react';
import { AssetPicker } from '../media/AssetPicker';

/**
 * §14.2 — the hotspot coordinate editor Spec §6 asks for: drag rectangles over
 * an image, the tool emits `HotspotImageConfig` JSON. Coordinates are in
 * normalised 0..1 space, exactly what the hotspot plugin's `score` hit-tests and
 * what {@link HotspotImageConfigSchema} validates. Pure frontend, sitting on top
 * of a contract that already exists.
 */

interface Target {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type Config = {
  gameType: 'HOTSPOT_IMAGE';
  promptAudioUrl: string;
  imageUrl: string;
  targets: Target[];
  correctTargetIds: string[];
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function normalizeConfig(value: Record<string, unknown>): Config {
  return {
    gameType: 'HOTSPOT_IMAGE',
    promptAudioUrl: typeof value.promptAudioUrl === 'string' ? value.promptAudioUrl : '',
    imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : '',
    targets: Array.isArray(value.targets) ? (value.targets as Target[]) : [],
    correctTargetIds: Array.isArray(value.correctTargetIds)
      ? (value.correctTargetIds as string[])
      : [],
  };
}

export function HotspotEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const cfg = normalizeConfig(value);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Target | null>(null);

  const patch = (next: Partial<Config>) => onChange({ ...cfg, ...next });

  function nextId(): string {
    let n = cfg.targets.length + 1;
    while (cfg.targets.some((t) => t.id === `target-${n}`)) n += 1;
    return `target-${n}`;
  }

  function pointToNorm(e: { clientX: number; clientY: number }) {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.target !== surfaceRef.current) return; // clicking a rect selects it instead
    const start = pointToNorm(e);
    setDraft({ id: '__draft', x: start.x, y: start.y, width: 0, height: 0 });
    surfaceRef.current!.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const p = pointToNorm(ev);
      setDraft({
        id: '__draft',
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        width: Math.abs(p.x - start.x),
        height: Math.abs(p.y - start.y),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDraft((d) => {
        if (d && d.width > 0.02 && d.height > 0.02) {
          const created: Target = { ...d, id: nextId() };
          patch({ targets: [...cfg.targets, created] });
          setSelected(created.id);
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function updateTarget(id: string, next: Partial<Target>) {
    patch({
      targets: cfg.targets.map((t) => (t.id === id ? { ...t, ...next } : t)),
    });
  }

  function removeTarget(id: string) {
    patch({
      targets: cfg.targets.filter((t) => t.id !== id),
      correctTargetIds: cfg.correctTargetIds.filter((c) => c !== id),
    });
    if (selected === id) setSelected(null);
  }

  function toggleCorrect(id: string) {
    patch({
      correctTargetIds: cfg.correctTargetIds.includes(id)
        ? cfg.correctTargetIds.filter((c) => c !== id)
        : [...cfg.correctTargetIds, id],
    });
  }

  return (
    <div className="hs">
      <div className="sf">
        <div className="sf-field">
          <span className="sf-label">שמע ההוראה</span>
          <AssetPicker
            kind="audio"
            value={cfg.promptAudioUrl}
            onChange={(url) => patch({ promptAudioUrl: url })}
          />
        </div>

        <div className="sf-field">
          <span className="sf-label">התמונה</span>
          <AssetPicker
            kind="image"
            value={cfg.imageUrl}
            onChange={(url) => patch({ imageUrl: url })}
          />
        </div>
      </div>

      <p className="sf-hint">גרור על התמונה כדי לצייר אזור מגע. לחץ על אזור קיים כדי לבחור אותו.</p>

      <div
        ref={surfaceRef}
        className="hs-surface"
        onPointerDown={onPointerDown}
        style={{
          position: 'relative',
          inlineSize: '100%',
          aspectRatio: '1 / 1',
          maxInlineSize: 560,
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--code-bg)',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      >
        {cfg.imageUrl && (
          <img
            src={cfg.imageUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              inlineSize: '100%',
              blockSize: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        )}
        {[...cfg.targets, ...(draft ? [draft] : [])].map((t) => {
          const isCorrect = cfg.correctTargetIds.includes(t.id);
          const isSel = selected === t.id;
          return (
            <div
              key={t.id}
              onPointerDown={(e) => {
                if (t.id === '__draft') return;
                e.stopPropagation();
                setSelected(t.id);
              }}
              style={{
                position: 'absolute',
                insetInlineStart: pct(t.x),
                insetBlockStart: pct(t.y),
                inlineSize: pct(t.width),
                blockSize: pct(t.height),
                border: `2px solid ${isSel ? 'var(--accent)' : isCorrect ? '#16a34a' : 'rgba(0,0,0,0.5)'}`,
                background: isCorrect ? 'rgba(22,163,74,0.15)' : 'rgba(170,59,255,0.08)',
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </div>

      <ul className="list hs-list">
        {cfg.targets.map((t) => (
          <li key={t.id} className={selected === t.id ? 'active' : ''}>
            <button
              type="button"
              className="list-main"
              onClick={() => setSelected(t.id === selected ? null : t.id)}
            >
              <code>{t.id}</code>
              {cfg.correctTargetIds.includes(t.id) && <span className="badge">נכון</span>}
            </button>
            <label className="sf-hint">
              <input
                type="checkbox"
                checked={cfg.correctTargetIds.includes(t.id)}
                onChange={() => toggleCorrect(t.id)}
              />{' '}
              תשובה נכונה
            </label>
            <button type="button" className="link danger" onClick={() => removeTarget(t.id)}>
              מחק
            </button>
          </li>
        ))}
        {cfg.targets.length === 0 && <li className="muted">אין אזורי מגע עדיין.</li>}
      </ul>

      {selected && (
        <fieldset className="sf-object">
          <legend>אזור {selected}</legend>
          {(['x', 'y', 'width', 'height'] as const).map((k) => {
            const t = cfg.targets.find((tt) => tt.id === selected);
            if (!t) return null;
            return (
              <label className="sf-field" key={k}>
                <span className="sf-label">{k}</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={t[k]}
                  onChange={(e) => updateTarget(selected, { [k]: clamp01(Number(e.target.value)) })}
                />
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
