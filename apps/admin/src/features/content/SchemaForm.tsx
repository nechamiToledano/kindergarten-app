import { useMemo } from 'react';

/**
 * §14.1 — the admin editor is *generated* from a game plugin's `configSchema`,
 * not hand-built per game type. We convert the Zod schema to JSON Schema
 * (`z.toJSONSchema`, Zod v4) once and render fields recursively from that. A new
 * game type becomes editable the moment its plugin is registered, with zero
 * admin-side work.
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

type Ctx = { defs: Record<string, JsonSchema>; hints: Record<string, string> };

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

function Field({
  label,
  schema,
  value,
  onChange,
  ctx,
  path,
}: {
  label: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  ctx: Ctx;
  path: string;
}) {
  const s = deref(schema, ctx);
  const hint = ctx.hints[path] ?? ctx.hints[label] ?? s.description;

  // Fixed literal (e.g. the gameType discriminant) — show, don't edit.
  if (s.const !== undefined) {
    return (
      <div className="sf-field">
        <span className="sf-label">{label}</span>
        <code>{String(s.const)}</code>
      </div>
    );
  }

  if (s.enum) {
    return (
      <label className="sf-field">
        <span className="sf-label">{label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {s.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        {hint && <span className="sf-hint">{hint}</span>}
      </label>
    );
  }

  const t = typeOf(s);

  if (t === 'boolean') {
    return (
      <label className="sf-field sf-inline">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="sf-label">{label}</span>
        {hint && <span className="sf-hint">{hint}</span>}
      </label>
    );
  }

  if (t === 'number' || t === 'integer') {
    return (
      <label className="sf-field">
        <span className="sf-label">{label}</span>
        <input
          type="number"
          value={value === '' || value === undefined ? '' : Number(value)}
          step={t === 'integer' ? 1 : 'any'}
          min={s.minimum}
          max={s.maximum}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {hint && <span className="sf-hint">{hint}</span>}
      </label>
    );
  }

  if (t === 'string') {
    const long = (s.maxLength ?? 0) > 120 || label.toLowerCase().includes('instruction');
    return (
      <label className="sf-field">
        <span className="sf-label">{label}</span>
        {long ? (
          <textarea
            rows={2}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        )}
        {hint && <span className="sf-hint">{hint}</span>}
      </label>
    );
  }

  if (t === 'object') {
    const val = (value ?? {}) as Record<string, unknown>;
    return (
      <fieldset className="sf-object">
        <legend>{label}</legend>
        {hint && <span className="sf-hint">{hint}</span>}
        {Object.entries(s.properties ?? {}).map(([key, sub]) => (
          <Field
            key={key}
            label={key}
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
    return (
      <fieldset className="sf-array">
        <legend>{label}</legend>
        {hint && <span className="sf-hint">{hint}</span>}
        {arr.map((item, i) => (
          <div className="sf-array-item" key={i}>
            <Field
              label={`#${i + 1}`}
              schema={(tuple ? tuple[i] : itemSchema) ?? {}}
              value={item}
              ctx={ctx}
              path={`${path}[]`}
              onChange={(v) => {
                const next = [...arr];
                next[i] = v;
                onChange(next);
              }}
            />
            {canRemove && (
              <button
                type="button"
                className="btn-ghost sf-remove"
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
              >
                הסר
              </button>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onChange([...arr, blankValue(itemSchema ?? {}, ctx)])}
          >
            + הוסף
          </button>
        )}
      </fieldset>
    );
  }

  // Fallback — anything the renderer doesn't model gets a JSON box.
  return (
    <label className="sf-field">
      <span className="sf-label">{label}</span>
      <textarea
        rows={2}
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* ignore until valid */
          }
        }}
      />
      {hint && <span className="sf-hint">{hint}</span>}
    </label>
  );
}

export function SchemaForm({
  jsonSchema,
  hints,
  value,
  onChange,
}: {
  jsonSchema: JsonSchema;
  hints: Record<string, string>;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const ctx = useMemo<Ctx>(
    () => ({ defs: jsonSchema.$defs ?? {}, hints }),
    [jsonSchema, hints],
  );
  const root = deref(jsonSchema, ctx);
  return (
    <div className="sf">
      {Object.entries(root.properties ?? {}).map(([key, sub]) => (
        <Field
          key={key}
          label={key}
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
