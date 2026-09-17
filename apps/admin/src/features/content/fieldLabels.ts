import type { GameTypeId } from '@kga/contracts';

/**
 * Hebrew display strings for the schema-generated content form.
 *
 * `SchemaForm` renders straight from each game plugin's Zod schema, so without
 * this dictionary a field shows its raw camelCase property name (e.g.
 * `correctOptionId`) and an enum shows its raw value (`BIGGER`). Everything
 * here is display-only — the underlying schema keys/values (what gets saved)
 * are untouched; only the label/option text shown to the admin changes.
 */

export const GAME_TYPE_LABELS: Record<GameTypeId, string> = {
  BINARY_IMAGE_CHOICE: 'בחירה בין שתי תמונות',
  MULTI_IMAGE_CHOICE: 'בחירה מתוך כמה תמונות',
  HOTSPOT_IMAGE: 'איתור אזור בתמונה',
  DRAG_MATCH: 'גרירה והתאמה',
  SEQUENTIAL_TAP: 'הקשה ברצף',
  COMPARISON: 'השוואה',
  PUZZLE: 'פאזל',
  PATTERN_COPY: 'איתור השונה',
  SYLLABLE_COUNT: 'ספירת הברות',
  PATTERN_SEQUENCE: 'המשך רצף',
  MANUAL_OBSERVATION: 'תצפית ידנית',
};

/**
 * Field names repeated across most/all plugins — checked before the
 * per-plugin overrides below, so a plugin only needs an entry here for
 * fields unique to it.
 */
const BASE_FIELD_LABELS: Record<string, string> = {
  gameType: 'סוג משחק',
  promptAudioUrl: 'שמע ההוראה',
  sequenceAudioUrls: 'קטעי שמע נוספים (ברצף אחרי ההוראה)',
  sampleImageUrl: 'תמונת דוגמה',
  imageUrl: 'תמונה',
  audioUrl: 'שמע',
  options: 'אפשרויות',
  id: 'מזהה',
  label: 'תווית',
  value: 'ערך',
  feedbackAudioUrl: 'שמע משוב',
  correctOptionId: 'מזהה האפשרות הנכונה',
  correctOptionIds: 'מזהי האפשרויות הנכונות',
  color: 'צבע',
};

/** Per-plugin field labels, keyed the same way SchemaForm looks hints up: dotted path first, then bare field name. */
export const FIELD_LABELS: Partial<Record<GameTypeId, Record<string, string>>> = {
  HOTSPOT_IMAGE: {
    targets: 'אזורי מגע',
    correctTargetIds: 'מזהי האזורים הנכונים',
    width: 'רוחב',
    height: 'גובה',
    x: 'מיקום אופקי (X)',
    y: 'מיקום אנכי (Y)',
  },
  DRAG_MATCH: {
    matchMode: 'שיטת התאמה',
    maxPerTarget: 'מספר מקסימלי לכל יעד',
    pairs: 'זוגות להתאמה',
    sourceId: 'מזהה המקור',
    sourceImageUrl: 'תמונת המקור',
    sourceAudioUrl: 'שמע המקור',
    targetId: 'מזהה היעד',
    targetImageUrl: 'תמונת היעד',
  },
  SEQUENTIAL_TAP: {
    validateEachStep: 'לבדוק כל הקשה בנפרד',
    pads: 'לחצנים',
    correctSequence: 'הרצף הנכון',
  },
  COMPARISON: {
    comparisonType: 'סוג ההשוואה',
    items: 'הפריטים להשוואה',
  },
  PUZZLE: {
    rows: 'שורות',
    cols: 'עמודות',
    pieceCount: 'מספר חלקים',
  },
  PATTERN_COPY: {
    oddOneOutId: 'מזהה הפריט השונה',
  },
  SYLLABLE_COUNT: {
    wordImageUrl: 'תמונת המילה',
    wordAudioUrl: 'שמע המילה',
    slotCount: 'מספר הברות',
    tokenCount: 'מספר האסימונים',
  },
  PATTERN_SEQUENCE: {
    palette: 'פריטי הבחירה',
    prefix: 'הרצף המוצג',
    blankCount: 'מספר המקומות הריקים',
    correctContinuation: 'ההמשך הנכון',
  },
  MANUAL_OBSERVATION: {
    observationPrompt: 'הנחיית התצפית',
  },
};

/** Hebrew versions of the game-engine's own field hints (packages/game-engine/src/plugins.ts). */
export const FIELD_HINTS: Partial<Record<GameTypeId, Record<string, string>>> = {
  BINARY_IMAGE_CHOICE: {
    correctOptionId: 'חייב להתאים למזהה של אחת משתי האפשרויות',
  },
  HOTSPOT_IMAGE: {
    targets: 'מלבנים במרחב מנורמל 0–1 (נערכים בעורך האזורים למטה)',
  },
  SEQUENTIAL_TAP: {
    correctSequence: 'מזהי לחצנים לפי הסדר; מזהה יכול לחזור על עצמו',
  },
  COMPARISON: {
    comparisonType: 'גדול יותר / קטן יותר / יותר / פחות / שווה',
  },
  PUZZLE: {
    pieceCount: 'חייב להיות שווה לשורות × עמודות (2/4/6/8/10)',
  },
  PATTERN_COPY: {
    oddOneOutId: 'חייב להתאים למזהה של אחת האפשרויות',
  },
  SYLLABLE_COUNT: {
    slotCount: 'מספר ההברות; מספר האסימונים חייב לעלות עליו במספר הפיתיונות',
  },
  PATTERN_SEQUENCE: {
    correctContinuation: 'מזהי הפריטים הממשיכים את הרצף המוצג, לפי הסדר',
  },
};

export const ENUM_VALUE_LABELS: Partial<Record<GameTypeId, Record<string, Record<string, string>>>> = {
  COMPARISON: {
    comparisonType: {
      BIGGER: 'גדול יותר',
      SMALLER: 'קטן יותר',
      MORE: 'יותר',
      FEWER: 'פחות',
      EQUAL: 'שווה',
    },
  },
  DRAG_MATCH: {
    matchMode: {
      EXACT: 'התאמה מדויקת (כל מקור ליעד שהוגדר לו)',
      BIJECTION: 'התאמת כמות (כל יעד מתמלא, לא משנה מאיזה מקור)',
    },
  },
};

function fieldLabelMap(gameType: GameTypeId): Record<string, string> {
  return { ...BASE_FIELD_LABELS, ...(FIELD_LABELS[gameType] ?? {}) };
}

/** `path` is the dotted/`[]` field path SchemaForm builds; `key` is the raw schema property name. */
export function fieldLabelOf(gameType: GameTypeId, path: string, key: string): string {
  const map = fieldLabelMap(gameType);
  return map[path] ?? map[key] ?? key;
}

export function fieldHintOf(gameType: GameTypeId, path: string, key: string): string | undefined {
  const map = FIELD_HINTS[gameType] ?? {};
  return map[path] ?? map[key];
}

export function enumValueLabelOf(gameType: GameTypeId, path: string, raw: string): string {
  return ENUM_VALUE_LABELS[gameType]?.[path]?.[raw] ?? raw;
}
