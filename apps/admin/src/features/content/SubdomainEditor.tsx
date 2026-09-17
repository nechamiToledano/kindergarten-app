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
import { Badge, Button, Field, Input, Select, Switch, Textarea } from '@kga/ui';
import { engineRegistry } from '../../shared/engine';
import { contentApi } from './api';
import { GAME_TYPE_LABELS } from './fieldLabels';
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
      blankValue(toJsonSchema('BINARY_IMAGE_CHOICE'), {
        defs: {},
        gameType: 'BINARY_IMAGE_CHOICE',
      }) as Record<string, unknown>,
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
    const next = blankValue(toJsonSchema(gameType), { defs: {}, gameType }) as Record<
      string,
      unknown
    >;
    setMeta((m) => ({ ...m, gameType }));
    setConfig(next);
    setRawText(JSON.stringify(next, null, 2));
    // The demo, if any, must be the same game type as the real trial — reblank
    // it rather than leave a stale config for a different mechanic behind.
    setDemoConfig((d) =>
      d === null ? null : (blankValue(toJsonSchema(gameType), { defs: {}, gameType }) as Record<string, unknown>),
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

  const demoParsed = demoConfig === null ? null : plugin.configSchema.safeParse(demoConfig);
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

  if (loading) return <p className="p-6 text-sm text-muted-foreground">טוען תת-תחום…</p>;

  return (
    <div className="grid gap-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">
          {existing ? `עריכת תת-תחום · גרסה ${existing.version ?? 1}` : 'תת-תחום חדש'}
        </h2>
        <Button type="button" variant="outline" onClick={onCancel}>
          חזרה
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="שם">
          <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </Field>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium">קבוצות גיל</span>
          {/* M10 §1 — age lives here now, and a subdomain may apply to more than
              one band. At least one must stay selected; the API rejects an empty
              list, and a game that applies to no age is unreachable content. */}
          <div className="flex flex-wrap gap-1.5">
            {AGE_GROUPS.map((ag) => {
              const on = meta.ageGroups.includes(ag);
              return (
                <Button
                  key={ag}
                  type="button"
                  size="sm"
                  variant={on ? 'secondary' : 'outline'}
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
                </Button>
              );
            })}
          </div>
        </div>

        <Field label="רמת קושי">
          <Select
            value={String(meta.level)}
            onChange={(e) => setMeta({ ...meta, level: Number(e.target.value) as SubdomainLevel })}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="סדר">
          <Input
            type="number"
            value={meta.orderIndex}
            onChange={(e) => setMeta({ ...meta, orderIndex: Number(e.target.value) })}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="הוראת גננת">
            <Textarea
              rows={2}
              value={meta.teacherInstruction}
              onChange={(e) => setMeta({ ...meta, teacherInstruction: e.target.value })}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="הוראת ילד">
            <Textarea
              rows={2}
              value={meta.childInstruction}
              onChange={(e) => setMeta({ ...meta, childInstruction: e.target.value })}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="סוג משחק">
            <Select value={meta.gameType} onChange={(e) => switchGameType(e.target.value as GameTypeId)}>
              {GAME_TYPES.map((gt) => (
                <option key={gt} value={gt}>
                  {GAME_TYPE_LABELS[gt]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            תצורת המשחק — {GAME_TYPE_LABELS[meta.gameType]}
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setRawMode((r) => !r)}>
            {rawMode ? 'חזרה לטופס' : 'עריכה מתקדמת (JSON)'}
          </Button>
        </div>

        {rawMode ? (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">
              עריכה ישירה של תצורת המשחק בפורמט JSON — מיועדת למשתמש מנוסה; שגיאת תחביר תמנע שמירה.
            </p>
            <Textarea
              className="font-mono text-xs"
              rows={16}
              value={rawText}
              onChange={(e) => onRawChange(e.target.value)}
            />
          </div>
        ) : meta.gameType === 'HOTSPOT_IMAGE' ? (
          <HotspotEditor value={config} onChange={applyConfig} />
        ) : (
          <SchemaForm jsonSchema={jsonSchema} gameType={meta.gameType} value={config} onChange={applyConfig} />
        )}
      </div>

      {issues.length > 0 && (
        <ul className="grid gap-1 rounded-lg border border-destructive bg-absent-soft px-4 py-3 text-sm">
          {issues.map((iss, i) => (
            <li key={i}>
              <code>{iss.path.join('.') || '(שורש)'}</code> — {iss.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">דוגמה מודגמת (לא לניקוד)</h3>
          <Switch
            checked={demoConfig !== null}
            onChange={(checked) =>
              setDemoConfig(
                checked
                  ? (blankValue(jsonSchema, { defs: {}, gameType: meta.gameType }) as Record<string, unknown>)
                  : null,
              )
            }
            label="הצג דוגמה לילד לפני הניסוי המנוקד"
          />
        </div>
        {demoConfig !== null &&
          (meta.gameType === 'HOTSPOT_IMAGE' ? (
            <HotspotEditor value={demoConfig} onChange={setDemoConfig} />
          ) : (
            <SchemaForm
              jsonSchema={jsonSchema}
              gameType={meta.gameType}
              value={demoConfig}
              onChange={setDemoConfig}
            />
          ))}
        {demoIssues.length > 0 && (
          <ul className="grid gap-1 rounded-lg border border-destructive bg-absent-soft px-4 py-3 text-sm">
            {demoIssues.map((iss, i) => (
              <li key={i}>
                <code>{iss.path.join('.') || '(שורש)'}</code> — {iss.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {assets.length > 0 && (
        <div className="grid gap-1.5">
          <h4 className="text-sm font-semibold text-muted-foreground">נכסים ({assets.length})</h4>
          <ul className="grid gap-1 text-sm">
            {assets.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <Badge>{a.kind === 'image' ? 'תמונה' : 'שמע'}</Badge>
                <code className="truncate">{a.url}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy || !parsed.success || !meta.name || (demoParsed !== null && !demoParsed.success)}
          loading={busy}
          onClick={save}
        >
          {existing ? 'שמור שינויים' : 'צור תת-תחום'}
        </Button>
        {existing && parsed.success && (
          <span className="text-sm text-muted-foreground">
            שינוי תצורה חותם גרסה חדשה — תוצאות קיימות נשארות מקושרות לגרסה הקודמת.
          </span>
        )}
      </div>
    </div>
  );
}
