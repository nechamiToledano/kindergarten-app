import { useMemo, useState } from 'react';
import { z } from 'zod';
import {
  GameTypeIdSchema,
  type AssetRef,
  type GameTypeId,
  type Subdomain,
} from '@kga/contracts';
import { engineRegistry } from '../../shared/engine';
import { contentApi } from './api';
import { HotspotEditor } from './HotspotEditor';
import { SchemaForm, blankValue, type JsonSchema } from './SchemaForm';

const GAME_TYPES = GameTypeIdSchema.options;

type Meta = {
  name: string;
  orderIndex: number;
  teacherInstruction: string;
  childInstruction: string;
  gameType: GameTypeId;
};

function toJsonSchema(gameType: GameTypeId): JsonSchema {
  const plugin = engineRegistry.get(gameType);
  return z.toJSONSchema(plugin.configSchema, { unrepresentable: 'any' }) as JsonSchema;
}

export function SubdomainEditor({
  domainId,
  existing,
  onDone,
  onCancel,
}: {
  domainId: string;
  existing: (Subdomain & { subdomainVersionId?: string; version?: number }) | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [meta, setMeta] = useState<Meta>({
    name: existing?.name ?? '',
    orderIndex: existing?.orderIndex ?? 0,
    teacherInstruction: existing?.teacherInstruction ?? '',
    childInstruction: existing?.childInstruction ?? '',
    gameType: existing?.gameType ?? 'BINARY_IMAGE_CHOICE',
  });

  const jsonSchema = useMemo(() => toJsonSchema(meta.gameType), [meta.gameType]);

  const [config, setConfig] = useState<Record<string, unknown>>(() => {
    if (existing && existing.gameConfig) return existing.gameConfig as Record<string, unknown>;
    return blankValue(toJsonSchema(meta.gameType), {
      defs: (jsonSchema.$defs ?? {}) as Record<string, JsonSchema>,
      hints: {},
    }) as Record<string, unknown>;
  });

  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(() => JSON.stringify(config, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plugin = engineRegistry.get(meta.gameType);
  const parsed = plugin.configSchema.safeParse(config);
  const issues: { path: (string | number | symbol)[]; message: string }[] = parsed.success
    ? []
    : parsed.error.issues;
  const assets: AssetRef[] = parsed.success ? plugin.assetsOf(parsed.data as never) : [];

  function switchGameType(gameType: GameTypeId) {
    const next = blankValue(toJsonSchema(gameType), { defs: {}, hints: {} }) as Record<
      string,
      unknown
    >;
    setMeta((m) => ({ ...m, gameType }));
    setConfig(next);
    setRawText(JSON.stringify(next, null, 2));
  }

  function applyConfig(v: Record<string, unknown>) {
    setConfig(v);
    setRawText(JSON.stringify(v, null, 2));
  }

  function onRawChange(text: string) {
    setRawText(text);
    try {
      setConfig(JSON.parse(text) as Record<string, unknown>);
      setError(null);
    } catch {
      setError('JSON לא תקין');
    }
  }

  async function save() {
    if (!parsed.success) {
      setError('התצורה אינה תקינה — תקן את השגיאות המסומנות');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        domainId,
        name: meta.name,
        orderIndex: Number(meta.orderIndex),
        teacherInstruction: meta.teacherInstruction,
        childInstruction: meta.childInstruction,
        gameType: meta.gameType,
        gameConfig: parsed.data as never,
      };
      if (existing) {
        await contentApi.updateSubdomain(existing.id, body);
      } else {
        await contentApi.createSubdomain(body);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor">
      <header className="editor-head">
        <h2>{existing ? `עריכת תת-תחום · v${existing.version ?? 1}` : 'תת-תחום חדש'}</h2>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          חזרה
        </button>
      </header>

      <div className="sf">
        <label className="sf-field">
          <span className="sf-label">שם</span>
          <input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </label>
        <label className="sf-field">
          <span className="sf-label">סדר</span>
          <input
            type="number"
            value={meta.orderIndex}
            onChange={(e) => setMeta({ ...meta, orderIndex: Number(e.target.value) })}
          />
        </label>
        <label className="sf-field">
          <span className="sf-label">הוראת גננת</span>
          <textarea
            rows={2}
            value={meta.teacherInstruction}
            onChange={(e) => setMeta({ ...meta, teacherInstruction: e.target.value })}
          />
        </label>
        <label className="sf-field">
          <span className="sf-label">הוראת ילד</span>
          <textarea
            rows={2}
            value={meta.childInstruction}
            onChange={(e) => setMeta({ ...meta, childInstruction: e.target.value })}
          />
        </label>
        <label className="sf-field">
          <span className="sf-label">סוג משחק</span>
          <select
            value={meta.gameType}
            onChange={(e) => switchGameType(e.target.value as GameTypeId)}
          >
            {GAME_TYPES.map((gt) => (
              <option key={gt} value={gt}>
                {engineRegistry.get(gt).meta.label} ({gt})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="editor-config">
        <div className="editor-config-head">
          <h3>תצורת המשחק — {plugin.meta.label}</h3>
          <button type="button" className="btn-ghost" onClick={() => setRawMode((r) => !r)}>
            {rawMode ? 'טופס' : 'JSON גולמי'}
          </button>
        </div>

        {rawMode ? (
          <textarea
            className="raw-json"
            rows={16}
            value={rawText}
            onChange={(e) => onRawChange(e.target.value)}
          />
        ) : meta.gameType === 'HOTSPOT_IMAGE' ? (
          <HotspotEditor value={config} onChange={applyConfig} />
        ) : (
          <SchemaForm
            jsonSchema={jsonSchema}
            hints={plugin.meta.hints}
            value={config}
            onChange={applyConfig}
          />
        )}
      </div>

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((iss, i) => (
            <li key={i}>
              <code>{iss.path.join('.') || '(root)'}</code> — {iss.message}
            </li>
          ))}
        </ul>
      )}

      {assets.length > 0 && (
        <div className="assets">
          <h4>נכסים ({assets.length})</h4>
          <ul>
            {assets.map((a, i) => (
              <li key={i}>
                <span className="badge">{a.kind}</span> <code>{a.url}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="row editor-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !parsed.success || !meta.name}
          onClick={save}
        >
          {busy ? 'שומר…' : existing ? 'שמור שינויים' : 'צור תת-תחום'}
        </button>
        {existing && parsed.success && (
          <span className="muted">
            שינוי תצורה חותם גרסה חדשה (§9.3) — תוצאות קיימות נשארות מקושרות לגרסה הקודמת.
          </span>
        )}
      </div>
    </div>
  );
}
