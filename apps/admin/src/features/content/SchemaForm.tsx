import { useMemo } from 'react';
import type { GameTypeId } from '@kga/contracts';
import { Button, Field, Input, Select, Switch, Textarea } from '@kga/ui';
import { AssetPicker } from '../media/AssetPicker';
import { enumValueLabelOf, fieldHintOf, fieldLabelOf } from './fieldLabels';

/**
 * §14.1 — the admin editor is *generated* from a game plugin's `configSchema`,
 * not hand-built per game type. We convert the Zod schema to JSON Schema
 * (`z.toJSONSchema`, Zod v4) once and render fields recursively from that. A new
 * game type becomes editable the moment its plugin is registered, with zero
 * admin-side work.
 *
 * Field/hint/enum text is Hebrew, resolved through `fieldLabels.ts` by the raw
 * schema key or dotted path — the schema keys themselves (what gets saved)
 * never change, only what's shown.
 */

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[] | false;
  prefixItems?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  description?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
};

type Ctx = { defs: Record<string, JsonSchema>; gameType: GameTypeId };

function deref(schema: JsonSchema, ctx: Ctx): JsonSchema {
  if (schema.$ref) {
    const name = schema.$ref.replace(/^#\/\$defs\//, '');
    return ctx.defs[name] ?? schema;
  }
  return schema;
}

function typeOf(schema: JsonSchema): string | undefined {
  return Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
}

/**
 * Every asset field across game-config.ts follows one naming convention:
 * ends in "Url"/"Urls" and names its kind (…Image…/…Audio…). That lets the
 * generated form swap a plain text box for the media-library picker without
 * each game plugin having to declare it.
 */
function assetKindOf(key: string): 'image' | 'audio' | null {
  if (!/urls?$/i.test(key)) return null;
  if (/audio/i.test(key)) return 'audio';
  if (/image/i.test(key)) return 'image';
  return null;
}

function blankValue(schema: JsonSchema, ctx: Ctx): unknown {
  const s = deref(schema, ctx);
  if (s.const !== undefined) return s.const;
  if (s.enum) return s.enum[0];
  if (s.anyOf?.length) return blankValue(s.anyOf[0], ctx);
  switch (typeOf(s)) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties ?? {})) out[k] = blankValue(v, ctx);
      return out;
    }
    case 'array': {
      const min = s.minItems ?? 0;
      if (s.prefixItems) return s.prefixItems.map((p) => blankValue(p, ctx));
      const item = (s.items && !Array.isArray(s.items) ? s.items : {}) as JsonSchema;
      return Array.from({ length: min }, () => blankValue(item, ctx));
    }
    case 'number':
    case 'integer':
      return s.minimum ?? 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

function Field_({
  fieldKey,
  schema,
  value,
  onChange,
  ctx,
  path,
}: {
  /** The raw schema property name (or `#index` marker for array items). */
  fieldKey: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  ctx: Ctx;
  path: string;
  /** For an array-of-scalar item: the asset kind of the *array's* own key, since the
   * item's fieldKey is replaced with a "#item N" placeholder before it reaches here. */
  forcedAssetKind?: 'image' | 'audio' | null;
}) {
  const s = deref(schema, ctx);
  const isArrayItem = fieldKey.startsWith('#');
  const label = isArrayItem ? fieldKey.slice(1) : fieldLabelOf(ctx.gameType, path, fieldKey);
  const hint = isArrayItem ? undefined : fieldHintOf(ctx.gameType, path, fieldKey) ?? s.description;

  // Fixed literal (e.g. the gameType discriminant) — show, don't edit.
  if (s.const !== undefined) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <code>{String(s.const)}</code>
      </div>
    );
  }

  if (s.enum) {
    return (
      <Field label={label} hint={hint}>
        <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {s.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {enumValueLabelOf(ctx.gameType, path, String(opt))}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  const t = typeOf(s);

  if (t === 'boolean') {
    return (
      <div className="flex flex-col gap-1">
        <Switch checked={Boolean(value)} onChange={onChange} label={label} />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  if (t === 'number' || t === 'integer') {
    return (
      <Field label={label} hint={hint}>
        <Input
          type="number"
          value={value === '' || value === undefined ? '' : Number(value)}
          step={t === 'integer' ? 1 : 'any'}
          min={s.minimum}
          max={s.maximum}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </Field>
    );
  }

  if (t === 'string') {
    const assetKind = isArrayItem ? forcedAssetKind : assetKindOf(fieldKey);
    if (assetKind) {
      return (
        <Field label={label} hint={hint}>
          <AssetPicker kind={assetKind} value={String(value ?? '')} onChange={onChange} />
        </Field>
      );
    }
    const long = (s.maxLength ?? 0) > 120 || /instruction|prompt/i.test(fieldKey);
    return (
      <Field label={label} hint={hint}>
        {long ? (
          <Textarea rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        )}
      </Field>
    );
  }

  if (t === 'object') {
    const val = (value ?? {}) as Record<string, unknown>;
    return (
      <fieldset className="grid gap-3 rounded-lg border border-border p-3.5">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">{label}</legend>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {Object.entries(s.properties ?? {}).map(([key, sub]) => (
          <Field_
            key={key}
            fieldKey={key}
            schema={sub}
            value={val[key]}
            ctx={ctx}
            path={`${path}.${key}`}
            onChange={(v) => onChange({ ...val, [key]: v })}
          />
        ))}
      </fieldset>
    );
  }

  if (t === 'array') {
    const arr = Array.isArray(value) ? value : [];
    const tuple = s.prefixItems;
    const itemSchema = (
      tuple ? undefined : s.items && !Array.isArray(s.items) ? s.items : {}
    ) as JsonSchema | undefined;
    const canAdd = !tuple && (s.maxItems === undefined || arr.length < s.maxItems);
    const canRemove = !tuple && arr.length > (s.minItems ?? 0);
    const itemAssetKind = tuple ? null : assetKindOf(fieldKey);
    return (
      <fieldset className="grid gap-3 rounded-lg border border-border p-3.5">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">{label}</legend>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {arr.map((item, i) => (
          <div className="grid gap-2 rounded-md border border-dashed border-border p-2.5" key={i}>
            <Field_
              fieldKey={`#פריט ${i + 1}`}
              schema={(tuple ? tuple[i] : itemSchema) ?? {}}
              value={item}
              ctx={ctx}
              path={`${path}[]`}
              forcedAssetKind={itemAssetKind}
              onChange={(v) => {
                const next = [...arr];
                next[i] = v;
                onChange(next);
              }}
            />
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
              >
                הסר
              </Button>
            )}
          </div>
        ))}
        {canAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => onChange([...arr, blankValue(itemSchema ?? {}, ctx)])}
          >
            + הוספת פריט
          </Button>
        )}
      </fieldset>
    );
  }

  // Fallback — anything the renderer doesn't model gets a JSON box.
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={2}
        className="font-mono text-xs"
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* ignore until valid */
          }
        }}
      />
    </Field>
  );
}

export function SchemaForm({
  jsonSchema,
  gameType,
  value,
  onChange,
}: {
  jsonSchema: JsonSchema;
  gameType: GameTypeId;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const ctx = useMemo<Ctx>(() => ({ defs: jsonSchema.$defs ?? {}, gameType }), [jsonSchema, gameType]);
  const root = deref(jsonSchema, ctx);
  return (
    <div className="grid gap-4">
      {Object.entries(root.properties ?? {}).map(([key, sub]) => (
        <Field_
          key={key}
          fieldKey={key}
          schema={sub}
          value={value[key]}
          ctx={ctx}
          path={key}
          onChange={(v) => onChange({ ...value, [key]: v })}
        />
      ))}
    </div>
  );
}

export { blankValue };
