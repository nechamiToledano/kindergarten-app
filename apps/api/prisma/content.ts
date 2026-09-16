import type { AgeGroup, GameConfig } from '@kga/contracts';

/**
 * M5 content catalogue (HLD §17, Spec §9) — the full seeded content tree across
 * all three age groups, organised by age group → domain → subdomain, matching
 * Spec §9's own tables. Content is data (§3.1): adding a subdomain is a new entry
 * here, never a code change.
 *
 * Media: real illustrations/recordings that already exist under
 * `apps/web/public/assets` are wired in directly by URL. Where no real asset
 * exists yet, `img()` emits an inline-SVG placeholder and `audio()` emits the
 * `tone:` scheme the web AudioUnlockProvider synthesises — both swap to real
 * URLs with no structural change the moment the asset lands (see the
 * launch-readiness report for the exact list still outstanding).
 *
 * Internal `id` fields are English identifiers (never transliterated Hebrew) —
 * they are code-level keys, not UI copy. `label` fields stay Hebrew: that text
 * is what the teacher/child actually see.
 *
 * This file is imported by `seed.ts` and validated, config by config, in
 * `content.spec.ts` (the §15 content-validation guardrail).
 */

/**
 * Kept in sync by hand with `apps/web/src/shared/assets/placeholder.ts`
 * (same swatches, same "tinted card + sticker label" shape) — this one runs
 * at seed time in Node, that one at render time in the browser for mock
 * fixtures, and duplicating a 20-line pure function is cheaper than sharing
 * a package across a Prisma seed script and a Vite app for this alone.
 */
const SWATCHES: { base: string; tint: string }[] = [
  { base: '#2b3a67', tint: '#6879ac' }, // navy
  { base: '#e0602f', tint: '#f0946b' }, // coral
  { base: '#d99a2e', tint: '#efc272' }, // amber
  { base: '#2f8f5b', tint: '#75c295' }, // pine green
  { base: '#b23a3a', tint: '#dd8686' }, // brick
  { base: '#3e6e8e', tint: '#82adc7' }, // slate blue
];

export function img(seed: string, label = seed): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const { base, tint } = SWATCHES[hash % SWATCHES.length];
  const text = label.replace(/[<>&]/g, '').slice(0, 18);
  const gradId = `g${hash % 1000}`;
  const bx = 46 + (hash % 90);
  const by = 40 + ((hash >> 5) % 50);
  const br = 62 + ((hash >> 9) % 34);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs><rect width="240" height="240" rx="30" fill="url(#${gradId})"/><circle cx="${bx}" cy="${by}" r="${br}" fill="#fff" opacity="0.16"/><circle cx="${232 - bx * 0.55}" cy="${226 - by * 0.6}" r="${br * 0.55}" fill="#fff" opacity="0.12"/><rect x="18" y="180" width="204" height="42" rx="21" fill="#fffdf9" opacity="0.96"/><text x="120" y="207" font-family="Assistant, system-ui, sans-serif" font-size="20" font-weight="700" fill="${base}" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const audio = (seed: string): string => `tone:${encodeURIComponent(seed)}`;

export interface SubdomainSpec {
  id: string;
  name: string;
  teacherInstruction: string;
  childInstruction: string;
  config: GameConfig;
}

export interface DomainSpec {
  id: string;
  name: string;
  orderIndex: number;
  subdomains: SubdomainSpec[];
}

export interface AgeGroupContent {
  ageGroup: AgeGroup;
  domains: DomainSpec[];
}

/**
 * M10 §1 — domains are global, so a name that appears under two age groups here
 * is one `Domain` row, not two. This table is the merge key.
 *
 * It intentionally matches the CASE expression in
 * `migrations/20260915120000_m10_domain_model/migration.sql`: the migration
 * folded the existing AgeGroupDomain rows using these slugs, and the seed has to
 * land on the same rows or a re-seed would fork the catalogue in two.
 */
export const DOMAIN_META: Record<string, { slug: string; icon: string; description: string }> = {
  'מודעות פונולוגית': {
    slug: 'phono',
    icon: 'audio-lines',
    description: 'זיהוי צלילים, הברות וחריזה — הבסיס לקריאה ולכתיבה.',
  },
  'תפיסה שמיעתית': {
    slug: 'auditory',
    icon: 'ear',
    description: 'הבחנה בין צלילים, זיכרון שמיעתי ורצף.',
  },
  'תפיסה חזותית': {
    slug: 'visual',
    icon: 'eye',
    description: 'הבחנה חזותית, דמות ורקע, מתכונת ורצף.',
  },
  'חשבון': {
    slug: 'math',
    icon: 'calculator',
    description: 'מספר, כמות, השוואה, ספירה והתאמה חד-חד-ערכית.',
  },
  'שפה ואוצר מילים': {
    slug: 'lang',
    icon: 'messages-square',
    description: 'שיום, הבנת הוראות, קטגוריות ומבנה משפט.',
  },
  'מוטוריקה': {
    slug: 'motor',
    icon: 'activity',
    description: 'מוטוריקה גסה ועדינה, שיווי משקל ותיאום עין-יד.',
  },
};

export function domainMetaFor(name: string): { slug: string; icon: string; description: string } {
  const known = DOMAIN_META[name];
  if (known) return known;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { slug: `domain-${hash.toString(16)}`, icon: 'circle-dot', description: '' };
}

/** `${prefix}` is an 8-hex-digit domain tag; `n` disambiguates rows under it. */
const uuid = (prefix: string, n: number): string =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ── AGE 4–5 · מודעות פונולוגית ──────────────────────────────────────────────
// Unchanged from M3 — keeps its original ids so results collected in M3/M4 stay
// linked to their subdomains and versions.
const PHONO_4_5_DOMAIN_ID = '44444444-4444-4444-8444-444444444444';

const phono4to5: DomainSpec = {
  id: PHONO_4_5_DOMAIN_ID,
  name: 'מודעות פונולוגית',
  orderIndex: 0,
  subdomains: [
    {
      id: '55555555-0001-4001-8001-000000000001',
      name: 'זיהוי צליל פותח',
      teacherInstruction:
        'הַשְׁמִיעִי לילד/ה את ההנחיה. הַצִּיגִי את שתי התמונות ובַקְּשִׁי לבחור את התמונה שֶׁשְּׁמָהּ מתחיל בצליל /שׁ/.',
      childInstruction: 'איזו תמונה מתחילה בצליל שְׁ? שֶׁמֶשׁ או תַּפּוּחַ?',
      config: {
        gameType: 'BINARY_IMAGE_CHOICE',
        promptAudioUrl: audio('צליל-פותח-ש'),
        options: [
          { id: 'sun', imageUrl: '/assets/object-sun.png', label: 'שמש' },
          { id: 'apple', imageUrl: '/assets/object-apple.png', label: 'תפוח' },
        ],
        correctOptionId: 'sun',
      },
    },
    {
      id: '55555555-0002-4002-8002-000000000002',
      name: 'זיהוי צליל סוגר',
      teacherInstruction:
        'בַּקְּשִׁי מהילד/ה לבחור את כל התמונות שֶׁשְּׁמָן מסתיים בצליל /ם/. יש יותר מתשובה אחת נכונה.',
      childInstruction: 'בחר/י את כל התמונות שמסתיימות בצליל ם.',
      config: {
        gameType: 'MULTI_IMAGE_CHOICE',
        promptAudioUrl: audio('צליל-סוגר-מם'),
        options: [
          { id: 'sea', imageUrl: '/assets/object-sea.png', label: 'ים' },
          { id: 'bread', imageUrl: '/assets/food-bread.png', label: 'לחם' },
          { id: 'dog', imageUrl: '/assets/object-dog.png', label: 'כלב' },
          { id: 'ladder', imageUrl: '/assets/object-ladder.png', label: 'סולם' },
        ],
        correctOptionIds: ['sea', 'bread', 'ladder'],
      },
    },
    {
      id: '55555555-0003-4003-8003-000000000003',
      name: 'מודעות להברות',
      teacherInstruction:
        'בַּתְּמוּנָה ארבעה חפצים על שולחן. בַּקְּשִׁי מהילד/ה להקיש על החפץ שֶׁשְּׁמוֹ מורכב משתי הברות (סֵ-פֶר).',
      childInstruction: 'הקש/י על החפץ שיש בשמו שתי הברות.',
      config: {
        gameType: 'HOTSPOT_IMAGE',
        promptAudioUrl: audio('הברות-ספר'),
        imageUrl: '/assets/syllables-table-scene.png',
        targets: [
          { id: 'banana', x: 0.18, y: 0.37, width: 0.2, height: 0.14 },
          { id: 'cup', x: 0.39, y: 0.37, width: 0.12, height: 0.13 },
          { id: 'book', x: 0.49, y: 0.39, width: 0.21, height: 0.13 },
          { id: 'cube', x: 0.7, y: 0.42, width: 0.09, height: 0.09 },
        ],
        correctTargetIds: ['book'],
      },
    },
    {
      id: '55555555-0004-4004-8004-000000000004',
      name: 'התאמת צליל פותח לאות',
      teacherInstruction: 'הַנִּיחִי שהילד/ה יגרור/תגרור כל תמונה אל האות שֶׁבָּהּ מתחיל שְׁמָהּ.',
      childInstruction: 'הקישו על תמונה למעלה, ואז הקישו על האות שבה היא מתחילה.',
      config: {
        gameType: 'DRAG_MATCH',
        promptAudioUrl: audio('התאמת-אות-פותחת'),
        pairs: [
          { sourceId: 'house', sourceImageUrl: '/assets/object-house.png', targetId: 'bet', targetImageUrl: '/assets/letter-bet.svg' },
          { sourceId: 'camel', sourceImageUrl: '/assets/animal-camel.png', targetId: 'gimel', targetImageUrl: '/assets/letter-gimel.svg' },
          { sourceId: 'fish', sourceImageUrl: '/assets/card-fish.png', targetId: 'dalet', targetImageUrl: '/assets/letter-dalet.svg' },
        ],
      },
    },
    {
      id: '55555555-0005-4005-8005-000000000005',
      name: 'הפקת חריזה',
      teacherInstruction:
        'תת-תחום נצפה. אִמְרִי לילד/ה מילה (למשל "כַּד") ובַקְּשִׁי ממנו/ממנה לומר מילה שמתחרזת איתה. דַּרְגִי לפי איכות ההפקה.',
      childInstruction: 'נסה/י לומר מילה שמתחרזת עם המילה שאמרתי.',
      config: {
        gameType: 'MANUAL_OBSERVATION',
        observationPrompt: 'הילד/ה מפיק/ה מילה מתחרזת נכונה באופן עצמאי.',
      },
    },
    {
      id: '55555555-0006-4006-8006-000000000006',
      name: 'צליל פותח — זיהוי מתוך תמונות הגן (שלב א)',
      teacherInstruction:
        'פעילות במוחש עם תמונות אמיתיות מהגן. הַצִּיגִי שתי תמונות של ילדים מהגן, אִמְרִי את הצליל הפותח של שֵׁם אחד מהם, ובַקְּשִׁי מהילד/ה להצביע על התמונה הנכונה.',
      childInstruction: 'הקשיבו לצליל שהגננת אומרת, והצביעו על התמונה הנכונה.',
      config: {
        gameType: 'MANUAL_OBSERVATION',
        observationPrompt: 'הילד/ה מצביע/ה על התמונה הנכונה לפי הצליל הפותח שנאמר.',
      },
    },
    {
      id: '55555555-0007-4007-8007-000000000007',
      name: 'צליל פותח — פרה, חמור, ג׳ירפה (שלב ב)',
      teacherInstruction:
        'קודם אִמְרִי את שמות שתי החיות בלי להדגיש צליל, ואז אִמְרִי רק את הצליל הפותח של אחת מהן. בַּקְּשִׁי מהילד/ה להצביע על החיה המתאימה.',
      childInstruction: 'איזו חיה מתחילה בצליל ששמעתם?',
      config: {
        gameType: 'BINARY_IMAGE_CHOICE',
        promptAudioUrl: audio('צליל-פותח-פרה-חמור'),
        options: [
          { id: 'cow', imageUrl: '/assets/object-cow.png', label: 'פרה' },
          { id: 'donkey', imageUrl: '/assets/animal-donkey.png', label: 'חמור' },
        ],
        correctOptionId: 'cow',
      },
    },
  ],
};

/**
 * A second round of the same activity with the third animal (Spec: "פרה, חמור,
 * גירפה – זה החיות שאני רוצה שיהיו במשחק"). `BinaryImageChoiceConfig` is
 * two-option only, so the three animals run as two subdomain instances rather
 * than one three-way round; both are seeded so all three appear across a
 * session. Real per-tap spoken feedback with emphasis on the opening sound
 * ("פ-פ-פ-פרה") is not yet built — today the generic TTS/tone prompt plays
 * once at the start of the exercise, not on every correct tap. That needs a
 * small addition to GamePlayer's CorrectFeedback phase, not a content change.
 */
const phono4to5Round2: SubdomainSpec = {
  id: '55555555-0008-4008-8008-000000000008',
  name: 'צליל פותח — חמור, ג׳ירפה (שלב ב, סבב שני)',
  teacherInstruction:
    'קודם אִמְרִי את שמות שתי החיות בלי להדגיש צליל, ואז אִמְרִי רק את הצליל הפותח של אחת מהן. בַּקְּשִׁי מהילד/ה להצביע על החיה המתאימה.',
  childInstruction: 'איזו חיה מתחילה בצליל ששמעתם?',
  config: {
    gameType: 'BINARY_IMAGE_CHOICE',
    promptAudioUrl: audio('צליל-פותח-חמור-גירפה'),
    options: [
      { id: 'donkey', imageUrl: '/assets/animal-donkey.png', label: 'חמור' },
      { id: 'giraffe', imageUrl: '/assets/animal-giraffe.png', label: 'ג׳ירפה' },
    ],
    correctOptionId: 'giraffe',
  },
};
phono4to5.subdomains.push(phono4to5Round2);

// ── AGE 3–4 ────────────────────────────────────────────────────────────────
const AGE_3_4: AgeGroupContent = {
  ageGroup: 'AGE_3_4',
  domains: [
    {
      id: uuid('a3100000', 0),
      name: 'מודעות פונולוגית',
      orderIndex: 0,
      subdomains: [
        {
          id: uuid('a3110000', 1),
          name: 'חריזה — חשיפה',
          teacherInstruction:
            'בשלב זה אין משחק דיגיטלי מלא. דַּקְלְמִי לילד/ה שיר עם חריזה בולטת ובִדְקִי קשב ושיתוף פעולה. דַּרְגִי את מידת ההיענות.',
          childInstruction: 'הקשיבו לשיר שהגננת אומרת.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה מקשיב/ה לחריזה, מצטרף/ת ומשלים/ה מילה חורזת בסיוע.',
          },
        },
      ],
    },
    {
      id: uuid('a3200000', 0),
      name: 'תפיסה שמיעתית',
      orderIndex: 1,
      subdomains: [
        {
          id: uuid('a3210000', 1),
          name: 'זיהוי צלילים — חלק א',
          teacherInstruction:
            'הַשְׁמִיעִי קול של בעל חיים מוכר (פרה). בַּקְּשִׁי מהילד/ה לבחור מבין שתי התמונות את בעל החיים שהשמיע את הקול.',
          childInstruction: 'איזה בעל חיים שמעתם? געו בתמונה.',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: '/assets/audio/sfx-cow.mp3',
            options: [
              { id: 'cow', imageUrl: '/assets/object-cow.png', label: 'פרה' },
              { id: 'cat', imageUrl: '/assets/animal-cat.png', label: 'חתול' },
            ],
            correctOptionId: 'cow',
          },
        },
        {
          id: uuid('a3210000', 2),
          name: 'זיהוי צלילים — חלק ב (התאמה)',
          teacherInstruction:
            'לפניך קולות בעלי חיים וכרטיסים. בַּקְּשִׁי מהילד/ה להתאים כל קול לכרטיס בעל החיים המתאים.',
          childInstruction: 'בחרו קול ואז געו בבעל החיים שלו.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('התאמת-קולות-חיות'),
            pairs: [
              { sourceId: 'sound-dog', sourceImageUrl: '/assets/sound-dog.png', targetId: 'dog', targetImageUrl: '/assets/object-dog.png' },
              { sourceId: 'sound-cat', sourceImageUrl: '/assets/sound-cat.png', targetId: 'cat', targetImageUrl: '/assets/animal-cat.png' },
            ],
          },
        },
        {
          id: uuid('a3210000', 3),
          name: 'זיכרון סדר צלילים',
          teacherInstruction:
            'הַשְׁמִיעִי שני צלילים ברצף (תוף ואז פעמון). בַּקְּשִׁי מהילד/ה לבחור מה נשמע ראשון.',
          childInstruction: 'מה שמעתם קודם?',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('תוף-פעמון-מי-ראשון'),
            options: [
              { id: 'drum', imageUrl: '/assets/object-drum.png', label: 'תוף' },
              { id: 'bell', imageUrl: '/assets/instrument-bell.png', label: 'פעמון' },
            ],
            correctOptionId: 'drum',
          },
        },
        {
          id: uuid('a3210000', 4),
          name: 'הוראה שמיעתית פשוטה',
          teacherInstruction:
            'פעילות פיזית בלבד. תְּנִי הוראה של שלב אחד ("שִׂים/י את הכדור בסל") ובִדְקִי ביצוע. דַּרְגִי לפי הבנה וביצוע.',
          childInstruction: 'הקשיבו לגננת ובצעו את מה שהיא מבקשת.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה מבצע/ת הוראה שמיעתית של שלב אחד ללא הדגמה.',
          },
        },
      ],
    },
    {
      id: uuid('a3300000', 0),
      name: 'תפיסה חזותית',
      orderIndex: 2,
      subdomains: [
        {
          id: uuid('a3310000', 1),
          name: 'התאמה — חפצים במוחש',
          teacherInstruction:
            'פעילות פיזית (סלסלת חפצים). בַּקְּשִׁי מהילד/ה למצוא בסל שני חפצים זהים. דַּרְגִי.',
          childInstruction: 'מצאו בסל שני חפצים שהם אותו דבר.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה מזהה ומתאים שני חפצים זהים מתוך סל מגוון.',
          },
        },
        {
          id: uuid('a3310000', 2),
          name: 'התאמת תמונות (לוטו)',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה למצוא בלוח את התמונה הזהה לתמונת הדוגמה.',
          childInstruction: 'איזו תמונה זהה לתמונה שלמעלה?',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('לוטו-מצא-זהה-כדור'),
            options: [
              { id: 'ball', imageUrl: '/assets/object-ball.png', label: 'כדור' },
              { id: 'doll', imageUrl: '/assets/object-doll.png', label: 'בובה' },
              { id: 'train', imageUrl: '/assets/object-train.png', label: 'רכבת' },
              { id: 'ball-match', imageUrl: '/assets/object-ball.png', label: 'כדור' },
            ],
            correctOptionIds: ['ball-match'],
          },
        },
        {
          id: uuid('a3310000', 3),
          name: 'דמות ורקע',
          teacherInstruction: 'בַּתְּמוּנָה גינה עמוסה. בַּקְּשִׁי מהילד/ה להקיש על הפח.',
          childInstruction: 'איפה הפח? געו בו בתמונה.',
          config: {
            gameType: 'HOTSPOT_IMAGE',
            promptAudioUrl: audio('איפה-הפח'),
            imageUrl: '/assets/hotspot-garden-scene.png',
            targets: [
              { id: 'trash-can', x: 0.74, y: 0.68, width: 0.15, height: 0.18 },
              { id: 'bench', x: 0.09, y: 0.58, width: 0.24, height: 0.22 },
              { id: 'tree', x: 0.37, y: 0.14, width: 0.28, height: 0.5 },
            ],
            correctTargetIds: ['trash-can'],
          },
        },
        {
          id: uuid('a3310000', 4),
          name: 'פאזל 4 חלקים',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה להרכיב את הפאזל. הַתְחִילִי בפאזל של 2 חלקים ואז 4.',
          childInstruction: 'הקישו על חלק למטה, ואז הקישו על המשבצת שלו למעלה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-4-חיה'),
            imageUrl: '/assets/puzzle-cow.png',
            rows: 2,
            cols: 2,
            pieceCount: 4,
          },
        },
      ],
    },
    {
      id: uuid('a3400000', 0),
      name: 'חשבון',
      orderIndex: 3,
      subdomains: [
        {
          id: uuid('a3410000', 1),
          name: 'ספירה / דפיקות',
          teacherInstruction:
            'פעילות פיזית-שמיעתית. דְּפֹקִי על השולחן מספר פעמים ובַקְּשִׁי מהילד/ה לדפוק אותו מספר. דַּרְגִי.',
          childInstruction: 'הקשיבו כמה פעמים דפקתי, ודפקו כמוני.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה חוזר/ת על 1–3 דפיקות במספר נכון.',
          },
        },
        {
          id: uuid('a3410000', 2),
          name: 'הרבה / מעט, גדול / קטן',
          teacherInstruction: 'הַצִּיגִי שתי תמונות. בַּקְּשִׁי מהילד/ה לבחור את התמונה שבה יש יותר.',
          childInstruction: 'באיזו תמונה יש יותר?',
          config: {
            gameType: 'COMPARISON',
            promptAudioUrl: audio('איפה-יש-יותר'),
            comparisonType: 'MORE',
            items: [
              { id: 'group-many', imageUrl: '/assets/count-5.png', value: 5, label: 'הרבה' },
              { id: 'group-few', imageUrl: '/assets/count-1.png', value: 1, label: 'מעט' },
            ],
          },
        },
        {
          id: uuid('a3410000', 3),
          name: 'תפיסת כמות 1–2',
          teacherInstruction: 'הַשְׁמִיעִי "שתיים". בַּקְּשִׁי מהילד/ה לבחור את הכרטיס שיש בו שתי נקודות.',
          childInstruction: 'איפה שתיים? געו בכרטיס הנכון.',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('כמות-שתיים'),
            options: [
              { id: 'card-1', imageUrl: '/assets/count-1.png', label: 'אחת' },
              { id: 'card-2', imageUrl: '/assets/count-2.png', label: 'שתיים' },
            ],
            correctOptionId: 'card-2',
          },
        },
      ],
    },
  ],
};

// ── AGE 4–5 (beyond the phonological-awareness domain) ─────────────────────
const AGE_4_5: AgeGroupContent = {
  ageGroup: 'AGE_4_5',
  domains: [
    phono4to5,
    {
      id: uuid('a4200000', 0),
      name: 'תפיסה שמיעתית',
      orderIndex: 1,
      subdomains: [
        {
          id: uuid('a4210000', 1),
          name: 'זיהוי צלילים — כלי נגינה',
          teacherInstruction: 'הַשְׁמִיעִי קול של כלי נגינה (תוף). בַּקְּשִׁי מהילד/ה לבחור את הכלי שנשמע.',
          childInstruction: 'איזה כלי נגינה שמעתם?',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: '/assets/audio/sfx-drum.wav',
            options: [
              { id: 'drum', imageUrl: '/assets/object-drum.png', label: 'תוף' },
              { id: 'flute', imageUrl: '/assets/instrument-flute.png', label: 'חליל' },
            ],
            correctOptionId: 'drum',
          },
        },
        {
          id: uuid('a4210000', 2),
          name: 'זיכרון סדר צלילים — שני כלים',
          teacherInstruction: 'הַשְׁמִיעִי תוף ואז חליל. בַּקְּשִׁי מהילד/ה לבחור מה נשמע אחרון.',
          childInstruction: 'מה שמעתם אחרון?',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('תוף-חליל-מי-אחרון'),
            options: [
              { id: 'drum', imageUrl: '/assets/object-drum.png', label: 'תוף' },
              { id: 'flute', imageUrl: '/assets/instrument-flute.png', label: 'חליל' },
            ],
            correctOptionId: 'flute',
          },
        },
        {
          id: uuid('a4210000', 3),
          name: 'זיכרון צבעים ברצף',
          teacherInstruction:
            'הַשְׁמִיעִי הוראה קולית של רצף צבעים ("אדום, כחול, אדום"). בַּקְּשִׁי מהילד/ה להקיש על הצבעים באותו סדר.',
          childInstruction: 'הקישו על הצבעים לפי הסדר ששמעתם.',
          config: {
            gameType: 'SEQUENTIAL_TAP',
            promptAudioUrl: audio('רצף-צבעים-אדום-כחול-אדום'),
            pads: [
              { id: 'red', color: '#ef4444', label: 'אדום' },
              { id: 'blue', color: '#3b82f6', label: 'כחול' },
              { id: 'green', color: '#10b981', label: 'ירוק' },
            ],
            correctSequence: ['red', 'blue', 'red'],
          },
        },
      ],
    },
    {
      id: uuid('a4300000', 0),
      name: 'תפיסה חזותית',
      orderIndex: 2,
      subdomains: [
        {
          id: uuid('a4310000', 1),
          name: 'מתכונת / רצף',
          teacherInstruction:
            'לפני הילד/ה רצף צבעים חסר. בַּקְּשִׁי לגרור את הצבע המתאים כדי להשלים את הרצף (אדום־כחול־אדום־כחול...).',
          childInstruction: 'הקישו על המשבצת החסרה, ואז הקישו על הצבע המתאים.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('השלמת-רצף-צבעים'),
            pairs: [
              { sourceId: 'slot-1', sourceImageUrl: '/assets/slot-1.png', targetId: 'red', targetImageUrl: '/assets/pattern-token-red.png' },
              { sourceId: 'slot-2', sourceImageUrl: '/assets/slot-2.png', targetId: 'blue', targetImageUrl: '/assets/token-blue.png' },
            ],
          },
        },
        {
          id: uuid('a4310000', 2),
          name: 'דמות ורקע — פריט בתמונה מורכבת',
          teacherInstruction: 'בַּתְּמוּנָה חדר משחקים עמוס. בַּקְּשִׁי מהילד/ה להקיש על הילד המתנדנד.',
          childInstruction: 'איפה הילד שמתנדנד? געו בו.',
          config: {
            gameType: 'HOTSPOT_IMAGE',
            promptAudioUrl: audio('איפה-הילד-מתנדנד'),
            imageUrl: '/assets/hotspot-playroom.png',
            targets: [
              { id: 'swing', x: 0.04, y: 0.03, width: 0.32, height: 0.68 },
              { id: 'table', x: 0.33, y: 0.55, width: 0.38, height: 0.42 },
              { id: 'cabinet', x: 0.68, y: 0.15, width: 0.3, height: 0.62 },
            ],
            correctTargetIds: ['swing'],
          },
        },
        {
          id: uuid('a4310000', 3),
          name: 'פאזל 6 חלקים',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה להרכיב פאזל של 6 חלקים.',
          childInstruction: 'הקישו על חלק למטה, ואז הקישו על המשבצת שלו למעלה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-6'),
            imageUrl: '/assets/puzzle-house.png',
            rows: 2,
            cols: 3,
            pieceCount: 6,
          },
        },
        {
          id: uuid('a4310000', 4),
          name: 'יוצא דופן',
          teacherInstruction:
            'הַצִּיגִי שלוש מכוניות; שתיים זהות ואחת שונה בצבע. בַּקְּשִׁי מהילד/ה להקיש על המכונית השונה.',
          childInstruction: 'איזו מכונית שונה מהאחרות?',
          config: {
            gameType: 'PATTERN_COPY',
            promptAudioUrl: audio('יוצא-דופן-מכוניות'),
            options: [
              { id: 'car-a', imageUrl: '/assets/car-a.png', label: 'מכונית' },
              { id: 'car-b', imageUrl: '/assets/car-b.png', label: 'מכונית' },
              { id: 'car-c', imageUrl: '/assets/car-c.png', label: 'מכונית' },
            ],
            oddOneOutId: 'car-c',
          },
        },
      ],
    },
    {
      id: uuid('a4400000', 0),
      name: 'חשבון',
      orderIndex: 3,
      subdomains: [
        {
          id: uuid('a4410000', 1),
          name: 'גדול / קטן',
          teacherInstruction: 'הַצִּיגִי שני עצמים. בַּקְּשִׁי מהילד/ה לבחור את הגדול.',
          childInstruction: 'מי גדול יותר?',
          config: {
            gameType: 'COMPARISON',
            promptAudioUrl: audio('מי-גדול'),
            comparisonType: 'BIGGER',
            items: [
              { id: 'elephant', imageUrl: '/assets/animal-elephant.png', value: 10, label: 'פיל' },
              { id: 'mouse', imageUrl: '/assets/animal-mouse.png', value: 1, label: 'עכבר' },
            ],
          },
        },
        {
          id: uuid('a4410000', 2),
          name: 'תפיסת כמות (עד 3)',
          teacherInstruction: 'הַשְׁמִיעִי "שלוש". בַּקְּשִׁי מהילד/ה לבחור מבין שלושה כרטיסים את זה עם שלושה עצמים.',
          childInstruction: 'איפה שלוש? געו בכרטיס.',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('כמות-שלוש'),
            options: [
              { id: 'count-1', imageUrl: '/assets/count-1.png', label: 'אחת' },
              { id: 'count-2', imageUrl: '/assets/count-2.png', label: 'שתיים' },
              { id: 'count-3', imageUrl: '/assets/count-three-apples.png', label: 'שלוש' },
            ],
            correctOptionIds: ['count-3'],
          },
        },
        {
          id: uuid('a4410000', 3),
          name: 'התאמה חד-חד-ערכית — עגלת סופר',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה לגרור כל מוצר אל העגלה המתאימה לו.',
          childInstruction: 'הקישו על מוצר למעלה, ואז הקישו על העגלה המתאימה לו למטה.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('עגלת-סופר'),
            pairs: [
              { sourceId: 'milk', sourceImageUrl: '/assets/food-milk.png', targetId: 'cart-milk', targetImageUrl: '/assets/food-cart.png' },
              { sourceId: 'bread', sourceImageUrl: '/assets/food-bread.png', targetId: 'cart-bread', targetImageUrl: '/assets/food-cart.png' },
              { sourceId: 'eggs', sourceImageUrl: '/assets/food-eggs.png', targetId: 'cart-eggs', targetImageUrl: '/assets/food-cart.png' },
            ],
          },
        },
        {
          id: uuid('a4410000', 4),
          name: 'מנייה — פונפונים',
          teacherInstruction:
            'פעילות במוחש. פַּזְּרִי פונפונים ובַקְּשִׁי מהילד/ה למנות אותם בשורה ואז בתפזורת. דַּרְגִי דיוק המנייה.',
          childInstruction: 'ספרו את הפונפונים.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה מונה עד 5 עצמים בהתאמה חד-חד-ערכית, גם בתפזורת.',
          },
        },
      ],
    },
  ],
};

// ── AGE 5–6 ────────────────────────────────────────────────────────────────
const AGE_5_6: AgeGroupContent = {
  ageGroup: 'AGE_5_6',
  domains: [
    {
      id: uuid('a5100000', 0),
      name: 'מודעות פונולוגית',
      orderIndex: 0,
      subdomains: [
        {
          id: uuid('a5110000', 1),
          name: 'צליל פותח — זיהוי מתוך שלוש',
          teacherInstruction:
            'הַשְׁמִיעִי את הצליל /מ/. בַּקְּשִׁי מהילד/ה לבחור מבין שלוש תמונות את זו שֶׁשְּׁמָהּ מתחיל ב-/מ/, ואז לשַׁיֵּם אותה בעצמו/ה.',
          childInstruction: 'איזו מילה מתחילה ב-מ? געו ואז אמרו את שמה.',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('צליל-פותח-מ-מתוך-3'),
            options: [
              { id: 'umbrella', imageUrl: '/assets/card-umbrella.png', label: 'מטריה' },
              { id: 'chair', imageUrl: '/assets/chair-color.png', label: 'כיסא' },
              { id: 'bag', imageUrl: '/assets/object-backpack.png', label: 'תיק' },
            ],
            correctOptionIds: ['umbrella'],
          },
        },
        {
          id: uuid('a5110000', 2),
          name: 'מילה ארוכה / קצרה',
          teacherInstruction:
            'הַשְׁמִיעִי שתי מילים (רַכֶּבֶת / אוֹטוֹ). בַּקְּשִׁי מהילד/ה לבחור איזו מילה ארוכה יותר.',
          childInstruction: 'איזו מילה ארוכה יותר?',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('ארוך-קצר-רכבת-אוטו'),
            options: [
              { id: 'train', imageUrl: '/assets/object-train.png', label: 'רכבת' },
              { id: 'car', imageUrl: '/assets/car-a.png', label: 'אוטו' },
            ],
            correctOptionId: 'train',
          },
        },
        {
          id: uuid('a5110000', 3),
          name: 'חלוקה להברות (3 הברות)',
          teacherInstruction:
            'בַּקְּשִׁי מהילד/ה לגרור עיגול אחד לכל הברה במילה. הַתְחִילִי במילים בנות 3 הברות (מְ-כוֹ-נִית).',
          childInstruction: 'הקישו על עיגול למעלה, ואז הקישו על ההברה שהוא שייך לה למטה.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('הברות-מכונית'),
            pairs: [
              { sourceId: 'circle-a', sourceImageUrl: '/assets/token-teal.png', targetId: 'syllable-1', targetImageUrl: '/assets/syllable-1.svg' },
              { sourceId: 'circle-b', sourceImageUrl: '/assets/token-teal.png', targetId: 'syllable-2', targetImageUrl: '/assets/syllable-2.svg' },
              { sourceId: 'circle-c', sourceImageUrl: '/assets/token-teal.png', targetId: 'syllable-3', targetImageUrl: '/assets/syllable-3.svg' },
            ],
          },
        },
        {
          id: uuid('a5110000', 4),
          name: 'אותיות — זיהוי ושיום',
          teacherInstruction:
            'תת-תחום הממתין לבירור תוכן (Spec §11.4). בינתיים: הַצִּיגִי אות ובַקְּשִׁי מהילד/ה לשַׁיֵּם אותה. דַּרְגִי ידנית.',
          childInstruction: 'איזו אות זו? אמרו את שמה.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה מזהה ומשַׁיֵּם 3–5 אותיות מוכרות. (תוכן מלא ממתין לבירור.)',
          },
        },
      ],
    },
    {
      id: uuid('a5200000', 0),
      name: 'תפיסה חזותית',
      orderIndex: 1,
      subdomains: [
        {
          id: uuid('a5210000', 1),
          name: 'מתכונת רצף — 3 צבעים',
          teacherInstruction:
            'הַשְׁמִיעִי רצף של שלושה צבעים חוזר. בַּקְּשִׁי מהילד/ה להקיש על הצבעים בסדר הנכון פעמיים.',
          childInstruction: 'המשיכו את הרצף — הקישו על הצבעים בסדר.',
          config: {
            gameType: 'SEQUENTIAL_TAP',
            promptAudioUrl: audio('רצף-3-צבעים'),
            pads: [
              { id: 'red', color: '#ef4444', label: 'אדום' },
              { id: 'blue', color: '#3b82f6', label: 'כחול' },
              { id: 'yellow', color: '#f59e0b', label: 'צהוב' },
            ],
            correctSequence: ['red', 'blue', 'yellow', 'red', 'blue', 'yellow'],
          },
        },
        {
          id: uuid('a5210000', 2),
          name: 'תמונה וצל',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה לגרור כל תמונה אל הצללית המתאימה לה.',
          childInstruction: 'התאימו כל תמונה לצל שלה.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('תמונה-וצל'),
            pairs: [
              { sourceId: 'orange', sourceImageUrl: '/assets/orange-color.png', targetId: 'shadow-orange', targetImageUrl: '/assets/orange-silhouette.png' },
              { sourceId: 'dog', sourceImageUrl: '/assets/dog-color.png', targetId: 'shadow-dog', targetImageUrl: '/assets/dog-silhouette.png' },
              { sourceId: 'chair', sourceImageUrl: '/assets/chair-color.png', targetId: 'shadow-chair', targetImageUrl: '/assets/chair-silhouette.png' },
            ],
          },
        },
        {
          id: uuid('a5210000', 3),
          name: 'פאזל 8 חלקים',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה להרכיב פאזל של 8 חלקים.',
          childInstruction: 'הקישו על חלק למטה, ואז הקישו על המשבצת שלו למעלה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-8'),
            imageUrl: '/assets/puzzle-flower.png',
            rows: 2,
            cols: 4,
            pieceCount: 8,
          },
        },
      ],
    },
    {
      id: uuid('a5300000', 0),
      name: 'חשבון',
      orderIndex: 2,
      subdomains: [
        {
          id: uuid('a5310000', 1),
          name: 'זיהוי ספרות 1–10',
          teacherInstruction: 'הַשְׁמִיעִי מספר ("שבע"). בַּקְּשִׁי מהילד/ה לבחור מבין ארבע ספרות את הספרה 7.',
          childInstruction: 'איפה הספרה שבע?',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('ספרה-שבע'),
            options: [
              { id: 'digit-3', imageUrl: '/assets/number-3.png', label: '3' },
              { id: 'digit-7', imageUrl: '/assets/number-7.png', label: '7' },
              { id: 'digit-5', imageUrl: '/assets/number-5.png', label: '5' },
              { id: 'digit-9', imageUrl: '/assets/number-9.png', label: '9' },
            ],
            correctOptionIds: ['digit-7'],
          },
        },
        {
          id: uuid('a5310000', 2),
          name: 'גדול / קטן / שווה — השוואת כמויות',
          teacherInstruction:
            'הַצִּיגִי שתי קבוצות עצמים בכמות זהה. בַּקְּשִׁי מהילד/ה לבחור אם באחת יש יותר, או להקיש "שווה".',
          childInstruction: 'האם הכמויות שוות, או שבאחת יש יותר?',
          config: {
            gameType: 'COMPARISON',
            promptAudioUrl: audio('שווה-או-יותר'),
            comparisonType: 'EQUAL',
            items: [
              { id: 'group-a', imageUrl: '/assets/count-4.png', value: 4, label: 'קבוצה א' },
              { id: 'group-b', imageUrl: '/assets/count-4.png', value: 4, label: 'קבוצה ב' },
            ],
          },
        },
        {
          id: uuid('a5310000', 3),
          name: 'תפיסת כמות עד 5',
          teacherInstruction: 'הַשְׁמִיעִי "חמש". בַּקְּשִׁי מהילד/ה לבחור את הכרטיס עם חמישה עצמים.',
          childInstruction: 'איפה חמש?',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('כמות-חמש'),
            options: [
              { id: 'count-4', imageUrl: '/assets/count-4.png', label: 'ארבע' },
              { id: 'count-5', imageUrl: '/assets/count-5.png', label: 'חמש' },
              { id: 'count-6', imageUrl: '/assets/count-6.png', label: 'שש' },
            ],
            correctOptionIds: ['count-5'],
          },
        },
        {
          id: uuid('a5310000', 4),
          name: 'ספירה עד 10',
          teacherInstruction:
            'פעילות מונחית. בַּקְּשִׁי מהילד/ה לספור בקול עד 10 תוך נגיעה בעצמים. דַּרְגִי רצף ודיוק.',
          childInstruction: 'ספרו איתי עד עשר.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה סופר/ת ברצף עד 10 עם התאמה חד-חד-ערכית.',
          },
        },
      ],
    },
  ],
};

export const CONTENT: AgeGroupContent[] = [AGE_3_4, AGE_4_5, AGE_5_6];
