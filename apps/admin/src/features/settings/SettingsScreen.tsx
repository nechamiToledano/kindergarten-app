import { useEffect, useState } from 'react';
import type { AppSetting, ConcernThreshold } from '@kga/contracts';
import { settingsApi } from './api';

/** {settingKey: [{field label, min, max, unit}]} for every numeric-fields setting. */
const NUMBER_FIELD_SETTINGS: Record<
  string,
  { title: string; description: string; fields: { key: string; label: string; min: number; max: number; unit?: string }[] }
> = {
  'assessment.ageBands': {
    title: 'חלוקת גיל לקבוצות',
    description: 'מאיזה גיל (בשנים מלאות) עוברים בין קבוצות הגיל של המערכת.',
    fields: [
      { key: 'band2MinAge', label: 'גיל מעבר מ-3–4 ל-4–5', min: 1, max: 10, unit: 'שנים' },
      { key: 'band3MinAge', label: 'גיל מעבר מ-4–5 ל-5–6', min: 1, max: 12, unit: 'שנים' },
    ],
  },
  'dashboard.display': {
    title: 'תצוגת לוח הבקרה',
    description: 'טווח הימים ל"מפגשים השבוע", וכמה שורות מוצגות בכל רשימת מפגשים.',
    fields: [
      { key: 'weekWindowDays', label: 'חלון "מפגשים השבוע"', min: 1, max: 90, unit: 'ימים' },
      { key: 'openSessionsLimit', label: 'שורות ברשימת מפגשים פתוחים', min: 1, max: 50 },
      { key: 'recentSessionsLimit', label: 'שורות ברשימת מפגשים אחרונים', min: 1, max: 50 },
    ],
  },
  'security.passwordPolicy': {
    title: 'מדיניות סיסמה',
    description: 'אורך מינימלי לסיסמה, לחשבונות צוות חדשים ולאיפוס סיסמה.',
    fields: [{ key: 'minLength', label: 'אורך מינימלי', min: 6, max: 64, unit: 'תווים' }],
  },
  'security.loginRateLimit': {
    title: 'הגבלת ניסיונות התחברות',
    description: 'כמה ניסיונות התחברות מותרים לכתובת IP בחלון הזמן, לפני חסימה זמנית.',
    fields: [
      { key: 'limit', label: 'ניסיונות מותרים' },
      { key: 'windowMs', label: 'חלון זמן', unit: 'מילישניות' },
    ].map((f) => ({ ...f, min: 1, max: f.key === 'limit' ? 1000 : 3_600_000 })),
  },
  'security.refreshRateLimit': {
    title: 'הגבלת חידוש חיבור',
    description: 'כמה בקשות חידוש טוקן מותרות לכתובת IP בחלון הזמן.',
    fields: [
      { key: 'limit', label: 'בקשות מותרות' },
      { key: 'windowMs', label: 'חלון זמן', unit: 'מילישניות' },
    ].map((f) => ({ ...f, min: 1, max: f.key === 'limit' ? 1000 : 3_600_000 })),
  },
};

/**
 * System-wide settings (M11 — real management, NETWORK_ADMIN only).
 *
 * Every row in `AppSetting` gets a dedicated editor here, keyed by its
 * `key` — a fallback raw-JSON editor handles any key this screen has not
 * grown a form for yet, so a new setting is usable from day one and a nice
 * form is a follow-up, not a blocker.
 */
export function SettingsScreen() {
  const [settings, setSettings] = useState<AppSetting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setSettings(null);
    settingsApi.list().then(setSettings).catch((e) => setError(errMsg(e)));
  }

  useEffect(load, []);

  async function save(key: string, value: unknown) {
    setError(null);
    try {
      await settingsApi.update(key, value);
      load();
    } catch (e) {
      setError(errMsg(e));
      throw e;
    }
  }

  return (
    <div className="browser">
      <p className="muted" style={{ marginBlockEnd: '1rem' }}>
        שינויים כאן משפיעים על כל הרשת מרגע השמירה. כל שדה מציג את ברירת המחדל עד שמישהו עורך אותו.
      </p>
      {error && <p className="error-text">{error}</p>}
      {!settings && <p className="muted">טוען…</p>}
      <div className="settings-list">
        {settings?.map((s) => {
          if (s.key === 'assessment.concernThreshold') {
            return <ConcernThresholdEditor key={s.key} setting={s} onSave={(v) => save(s.key, v)} />;
          }
          const spec = NUMBER_FIELD_SETTINGS[s.key];
          if (spec) {
            return (
              <NumberFieldsEditor
                key={s.key}
                setting={s}
                title={spec.title}
                description={spec.description}
                fields={spec.fields}
                onSave={(v) => save(s.key, v)}
              />
            );
          }
          return <RawSettingEditor key={s.key} setting={s} onSave={(v) => save(s.key, v)} />;
        })}
      </div>
    </div>
  );
}

function SettingCard({
  title,
  description,
  updatedAt,
  children,
}: {
  title: string;
  description?: string | null;
  updatedAt: string | null;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="sf-object">
      <legend>{title}</legend>
      <div className="sf">
        {description && <p className="muted">{description}</p>}
        {children}
        <p className="muted">
          {updatedAt ? `נערך לאחרונה: ${new Date(updatedAt).toLocaleString('he-IL')}` : 'ברירת מחדל — טרם נערך.'}
        </p>
      </div>
    </fieldset>
  );
}

function ConcernThresholdEditor({
  setting,
  onSave,
}: {
  setting: AppSetting;
  onSave: (value: ConcernThreshold) => Promise<void>;
}) {
  const value = setting.value as ConcernThreshold;
  const [minAssessed, setMinAssessed] = useState(value.minAssessed);
  const [concernPct, setConcernPct] = useState(Math.round(value.concernRatio * 100));
  const [busy, setBusy] = useState(false);

  const dirty = minAssessed !== value.minAssessed || concernPct !== Math.round(value.concernRatio * 100);

  async function submit() {
    setBusy(true);
    try {
      await onSave({ minAssessed, concernRatio: concernPct / 100 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard
      title={'סף "טעון תשומת לב"'}
      description='קובע מתי ילד מסומן אוטומטית כטעון תשומת לב בלוח הבקרה, בנוסף לסימון ידני של גננת.'
      updatedAt={setting.updatedAt}
    >
      <label className="sf-field sf-inline">
        <span className="sf-label">מינימום תוצאות שנבדקו</span>
        <input
          type="number"
          min={1}
          max={50}
          value={minAssessed}
          onChange={(e) => setMinAssessed(Number(e.target.value))}
        />
      </label>
      <label className="sf-field sf-inline">
        <span className="sf-label">אחוז דאגה (נעדר/חלקי) שמפעיל את הסימון</span>
        <input
          type="number"
          min={0}
          max={100}
          value={concernPct}
          onChange={(e) => setConcernPct(Number(e.target.value))}
        />
        <span className="sf-hint">%</span>
      </label>
      <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={submit}>
        {busy ? 'שומר…' : 'שמור'}
      </button>
    </SettingCard>
  );
}

/**
 * Generic editor for any setting whose value is a flat object of numbers —
 * covers age bands, dashboard display and the security policies. A new
 * setting like these needs one entry in `NUMBER_FIELD_SETTINGS`, not a new
 * component.
 */
function NumberFieldsEditor({
  setting,
  title,
  description,
  fields,
  onSave,
}: {
  setting: AppSetting;
  title: string;
  description: string;
  fields: { key: string; label: string; min: number; max: number; unit?: string }[];
  onSave: (value: Record<string, number>) => Promise<void>;
}) {
  const original = setting.value as Record<string, number>;
  const [values, setValues] = useState<Record<string, number>>(original);
  const [busy, setBusy] = useState(false);

  const dirty = fields.some((f) => values[f.key] !== original[f.key]);

  async function submit() {
    setBusy(true);
    try {
      await onSave(values);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard title={title} description={description} updatedAt={setting.updatedAt}>
      {fields.map((f) => (
        <label key={f.key} className="sf-field sf-inline">
          <span className="sf-label">{f.label}</span>
          <input
            type="number"
            min={f.min}
            max={f.max}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
          />
          {f.unit && <span className="sf-hint">{f.unit}</span>}
        </label>
      ))}
      <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={submit}>
        {busy ? 'שומר…' : 'שמור'}
      </button>
    </SettingCard>
  );
}

function RawSettingEditor({
  setting,
  onSave,
}: {
  setting: AppSetting;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [text, setText] = useState(() => JSON.stringify(setting.value, null, 2));
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function submit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setParseError('JSON לא תקין');
      return;
    }
    setParseError(null);
    setBusy(true);
    try {
      await onSave(parsed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard title={setting.key} description={setting.description} updatedAt={setting.updatedAt}>
      <textarea className="raw-json" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      {parseError && <p className="error-text">{parseError}</p>}
      <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
        {busy ? 'שומר…' : 'שמור'}
      </button>
    </SettingCard>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'שגיאה';
}
