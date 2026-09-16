import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import {
  AgeGroupSchema,
  GameTypeIdSchema,
  type AgeGroup,
  type AssetRef,
  type GameTypeId,
  type SubdomainForPlay,
  type SubdomainLevel,
} from '@kga/contracts';
import { engineRegistry } from '../../shared/engine';
import { contentApi } from './api';
import { HotspotEditor } from './HotspotEditor';
import { SchemaForm, blankValue, type JsonSchema } from './SchemaForm';

const GAME_TYPES = GameTypeIdSchema.options;
const AGE_GROUPS = AgeGroupSchema.options;
const AGE_LABEL: Record<AgeGroup, string> = {
  AGE_3_4: '3–4',
  AGE_4_5: '4–5',
  AGE_5_6: '5–6',
};
const LEVELS: { value: SubdomainLevel; label: string }[] = [
  { value: 1, label: 'בסיסי' },
  { value: 2, label: 'מתפתח' },
  { value: 3, label: 'מתקדם' },
];

type Meta = {
  name: string;
  orderIndex: number;
  ageGroups: AgeGroup[];
  level: SubdomainLevel;
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
  subdomainId,
  defaultAgeGroup,
  onDone,
  onCancel,
}: {
  domainId: string;
  /** null for a new subdomain; otherwise the row to load in full. */
  subdomainId: string | null;
  /** A new subdomain starts in the band the browser is filtered to. */
  defaultAgeGroup: AgeGroup;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Loaded rather than passed in: the browser lists summaries, which carry no
  // gameConfig, and the editor must never open on a partial record.
  const [existing, setExisting] = useState<SubdomainForPlay | null>(null);
  const [loading, setLoading] = useState(subdomainId !== null);

  const [meta, setMeta] = useState<Meta>({
    name: '',
    orderIndex: 0,
    ageGroups: [defaultAgeGroup],
    level: 1,
    teacherInstruction: '',
    childInstruction: '',
    gameType: 'BINARY_IMAGE_CHOICE',
  });

  const jsonSchema = useMemo(() => toJsonSchema(meta.gameType), [meta.gameType]);

  const [config, setConfig] = useState<Record<string, unknown>>(
    () =>
      blankValue(toJsonSchema('BINARY_IMAGE_CHOICE'), { defs: {}, hints: {} }) as Record<
        string,
        unknown
      >,
  );

  // An ungraded worked example shown before the scored trial (§ demoConfig).
  // null means "no demo" — the checkbox in the config header turns it on/off.
  const [demoConfig, setDemoConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!subdomainId) return;
    let alive = true;
    contentApi
      .getSubdomain(subdomainId)
      .then((row) => {
        if (!alive) return;
        setExisting(row);
        setMeta({
          name: row.name,
          orderIndex: row.orderIndex,
          ageGroups: row.ageGroups,
          level: row.level,
          teacherInstruction: row.teacherInstruction,
          childInstruction: row.childInstruction,
          gameType: row.gameType,
        });
        const cfg = row.gameConfig as Record<string, unknown>;
        setConfig(cfg);
        setRawText(JSON.stringify(cfg, null, 2));
        setDemoConfig((row.demoConfig as Record<string, unknown> | null) ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'הטעינה נכשלה'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [subdomainId]);

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
    // The demo, if any, must be the same game type as the real trial — reblank
    // it rather than leave a stale config for a different mechanic behind.
    setDemoConfig((d) =>
      d === null
        ? null
        : (blankValue(toJsonSchema(gameType), { defs: {}, hints: {} }) as Record<string, unknown>),
    );
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

  const demoParsed =
    demoConfig === null ? null : plugin.configSchema.safeParse(demoConfig);
  const demoIssues: { path: (string | number | symbol)[]; message: string }[] =
    demoParsed && !demoParsed.success ? demoParsed.error.issues : [];

  async function save() {
    if (!parsed.success || (demoParsed && !demoParsed.success)) {
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
        ageGroups: meta.ageGroups,
        level: meta.level,
        teacherInstruction: meta.teacherInstruction,
        childInstruction: meta.childInstruction,
        gameType: meta.gameType,
        gameConfig: parsed.data as never,
        demoConfig: (demoParsed ? demoParsed.data : null) as never,
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

  if (loading) return <p className="muted pad">טוען תת-תחום…</p>;

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
        <fieldset className="sf-field">
          <span className="sf-label">קבוצות גיל</span>
          {/* M10 §1 — age lives here now, and a subdomain may apply to more than
              one band. At least one must stay selected; the API rejects an empty
              list, and a game that applies to no age is unreachable content. */}
          <div className="row">
            {AGE_GROUPS.map((ag) => {
              const on = meta.ageGroups.includes(ag);
              return (
                <button
                  key={ag}
                  type="button"
                  className={`tab ${on ? 'tab-active' : ''}`}
                  aria-pressed={on}
                  onClick={() =>
                    setMeta((m) => {
                      const next = on
                        ? m.ageGroups.filter((x) => x !== ag)
                        : [...m.ageGroups, ag];
                      return next.length === 0 ? m : { ...m, ageGroups: next };
                    })
                  }
                >
                  {AGE_LABEL[ag]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="sf-field">
          <span className="sf-label">רמת קושי</span>
          <select
            value={meta.level}
            onChange={(e) =>
              setMeta({ ...meta, level: Number(e.target.value) as SubdomainLevel })
            }
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
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

      <div className="editor-config">
        <div className="editor-config-head">
          <h3>דוגמה מודגמת (לא לניקוד)</h3>
          <label className="row" style={{ gap: '0.4rem' }}>
            <input
              type="checkbox"
              checked={demoConfig !== null}
              onChange={(e) =>
                setDemoConfig(
                  e.target.checked
                    ? (blankValue(jsonSchema, { defs: {}, hints: {} }) as Record<string, unknown>)
                    : null,
                )
              }
            />
            הצג דוגמה לילד לפני הניסוי המנוקד
          </label>
        </div>
        {demoConfig !== null &&
          (meta.gameType === 'HOTSPOT_IMAGE' ? (
            <HotspotEditor value={demoConfig} onChange={setDemoConfig} />
          ) : (
            <SchemaForm
              jsonSchema={jsonSchema}
              hints={plugin.meta.hints}
              value={demoConfig}
              onChange={setDemoConfig}
            />
          ))}
        {demoIssues.length > 0 && (
          <ul className="issues">
            {demoIssues.map((iss, i) => (
              <li key={i}>
                <code>{iss.path.join('.') || '(root)'}</code> — {iss.message}
              </li>
            ))}
          </ul>
        )}
      </div>

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
          disabled={busy || !parsed.success || !meta.name || (demoParsed !== null && !demoParsed.success)}
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
