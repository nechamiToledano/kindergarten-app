import type { AgeGroup, GameConfig } from '@kga/contracts';

/**
 * M5 content catalogue (HLD §17, Spec §9) — the full seeded content tree across
 * all three age groups, organised by age group → domain → subdomain, matching
 * Spec §9's own tables. Content is data (§3.1): adding a subdomain is a new entry
 * here, never a code change.
 *
 * Media stays on placeholders (Spec §8 / HLD §18.2 — human voice recordings and
 * licensed illustrations are a long-lead dependency running alongside, not before,
 * the engine work). `img()` emits an inline-SVG data URI; `audio()` emits the
 * `tone:` scheme the web AudioUnlockProvider synthesises. Both swap to real URLs
 * with no structural change when the asset pipeline lands.
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
          { id: 'shemesh', imageUrl: img('shemesh', 'שמש'), label: 'שמש' },
          { id: 'tapuach', imageUrl: img('tapuach', 'תפוח'), label: 'תפוח' },
        ],
        correctOptionId: 'shemesh',
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
          { id: 'yam', imageUrl: img('yam', 'ים'), label: 'ים' },
          { id: 'lechem', imageUrl: img('lechem', 'לחם'), label: 'לחם' },
          { id: 'kelev', imageUrl: img('kelev', 'כלב'), label: 'כלב' },
          { id: 'sulam', imageUrl: img('sulam', 'סולם'), label: 'סולם' },
        ],
        correctOptionIds: ['yam', 'lechem', 'sulam'],
      },
    },
    {
      id: '55555555-0003-4003-8003-000000000003',
      name: 'מודעות להברות',
      teacherInstruction:
        'בַּתְּמוּנָה שלושה חפצים. בַּקְּשִׁי מהילד/ה להקיש על החפץ שֶׁשְּׁמוֹ מורכב משתי הברות (בַּ-לוֹן).',
      childInstruction: 'הקש/י על החפץ שיש בשמו שתי הברות.',
      config: {
        gameType: 'HOTSPOT_IMAGE',
        promptAudioUrl: audio('הברות-בלון'),
        imageUrl: img('scene-hevrot', 'שולחן חפצים'),
        targets: [
          { id: 'kos', x: 0.05, y: 0.35, width: 0.26, height: 0.5 },
          { id: 'balon', x: 0.37, y: 0.1, width: 0.28, height: 0.62 },
          { id: 'mispachaim', x: 0.7, y: 0.32, width: 0.26, height: 0.52 },
        ],
        correctTargetIds: ['balon'],
      },
    },
    {
      id: '55555555-0004-4004-8004-000000000004',
      name: 'התאמת צליל פותח לאות',
      teacherInstruction: 'הַנִּיחִי שהילד/ה יגרור/תגרור כל תמונה אל האות שֶׁבָּהּ מתחיל שְׁמָהּ.',
      childInstruction: 'גרור/גררי כל תמונה אל האות שבה היא מתחילה.',
      config: {
        gameType: 'DRAG_MATCH',
        promptAudioUrl: audio('התאמת-אות-פותחת'),
        pairs: [
          { sourceId: 'bayit', sourceImageUrl: img('bayit', 'בית'), targetId: 'bet', targetImageUrl: img('ot-bet', 'ב') },
          { sourceId: 'gamal', sourceImageUrl: img('gamal', 'גמל'), targetId: 'gimel', targetImageUrl: img('ot-gimel', 'ג') },
          { sourceId: 'dag', sourceImageUrl: img('dag', 'דג'), targetId: 'dalet', targetImageUrl: img('ot-dalet', 'ד') },
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
  ],
};

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
            promptAudioUrl: audio('קול-פרה'),
            options: [
              { id: 'para', imageUrl: img('para', 'פרה'), label: 'פרה' },
              { id: 'chatul', imageUrl: img('chatul', 'חתול'), label: 'חתול' },
            ],
            correctOptionId: 'para',
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
              { sourceId: 'kol-kelev', sourceImageUrl: img('kol-kelev', 'הב הב'), targetId: 'kelev', targetImageUrl: img('kelev34', 'כלב') },
              { sourceId: 'kol-chatul', sourceImageUrl: img('kol-chatul', 'מיאו'), targetId: 'chatul', targetImageUrl: img('chatul34', 'חתול') },
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
              { id: 'tof', imageUrl: img('tof', 'תוף'), label: 'תוף' },
              { id: 'paamon', imageUrl: img('paamon', 'פעמון'), label: 'פעמון' },
            ],
            correctOptionId: 'tof',
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
              { id: 'kadur', imageUrl: img('kadur', 'כדור'), label: 'כדור' },
              { id: 'buba', imageUrl: img('buba', 'בובה'), label: 'בובה' },
              { id: 'rakevet', imageUrl: img('rakevet', 'רכבת'), label: 'רכבת' },
              { id: 'kadur2', imageUrl: img('kadur', 'כדור'), label: 'כדור' },
            ],
            correctOptionIds: ['kadur2'],
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
            imageUrl: img('gina-scene', 'גינה'),
            targets: [
              { id: 'pach', x: 0.62, y: 0.45, width: 0.2, height: 0.4 },
              { id: 'safsal', x: 0.1, y: 0.5, width: 0.3, height: 0.25 },
              { id: 'ec', x: 0.4, y: 0.05, width: 0.22, height: 0.5 },
            ],
            correctTargetIds: ['pach'],
          },
        },
        {
          id: uuid('a3310000', 4),
          name: 'פאזל 4 חלקים',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה להרכיב את הפאזל. הַתְחִילִי בפאזל של 2 חלקים ואז 4.',
          childInstruction: 'הרכיבו את התמונה מהחלקים.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-4-חיה'),
            imageUrl: img('puzzle-para', 'פרה'),
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
              { id: 'kvutza-gdola', imageUrl: img('many-apples', '5 תפוחים'), value: 5, label: 'הרבה' },
              { id: 'kvutza-ktana', imageUrl: img('one-apple', 'תפוח אחד'), value: 1, label: 'מעט' },
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
              { id: 'card-1', imageUrl: img('dot-1', 'נקודה'), label: 'אחת' },
              { id: 'card-2', imageUrl: img('dot-2', 'שתי נקודות'), label: 'שתיים' },
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
            promptAudioUrl: audio('קול-תוף'),
            options: [
              { id: 'tof', imageUrl: img('tof45', 'תוף'), label: 'תוף' },
              { id: 'chalil', imageUrl: img('chalil45', 'חליל'), label: 'חליל' },
            ],
            correctOptionId: 'tof',
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
              { id: 'tof', imageUrl: img('tof45', 'תוף'), label: 'תוף' },
              { id: 'chalil', imageUrl: img('chalil45', 'חליל'), label: 'חליל' },
            ],
            correctOptionId: 'chalil',
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
              { id: 'adom', color: '#ef4444', label: 'אדום' },
              { id: 'kachol', color: '#3b82f6', label: 'כחול' },
              { id: 'yarok', color: '#10b981', label: 'ירוק' },
            ],
            correctSequence: ['adom', 'kachol', 'adom'],
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
          childInstruction: 'גררו את הצבע שממשיך את הרצף.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('השלמת-רצף-צבעים'),
            pairs: [
              { sourceId: 'chser-1', sourceImageUrl: img('slot-a', 'חסר'), targetId: 'adom', targetImageUrl: img('col-adom', 'אדום') },
              { sourceId: 'chser-2', sourceImageUrl: img('slot-b', 'חסר'), targetId: 'kachol', targetImageUrl: img('col-kachol', 'כחול') },
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
            imageUrl: img('playroom', 'חדר משחק'),
            targets: [
              { id: 'nadneda', x: 0.55, y: 0.2, width: 0.3, height: 0.55 },
              { id: 'shulchan', x: 0.05, y: 0.55, width: 0.35, height: 0.3 },
              { id: 'aron', x: 0.05, y: 0.05, width: 0.25, height: 0.45 },
            ],
            correctTargetIds: ['nadneda'],
          },
        },
        {
          id: uuid('a4310000', 3),
          name: 'פאזל 6 חלקים',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה להרכיב פאזל של 6 חלקים.',
          childInstruction: 'הרכיבו את התמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-6'),
            imageUrl: img('puzzle-bayit', 'בית'),
            rows: 2,
            cols: 3,
            pieceCount: 6,
          },
        },
        {
          id: uuid('a4310000', 4),
          name: 'יוצא דופן',
          teacherInstruction:
            'הַצִּיגִי שלוש תמונות; שתיים דומות ואחת שונה. בַּקְּשִׁי מהילד/ה להקיש על התמונה השונה.',
          childInstruction: 'איזו תמונה שונה מהאחרות?',
          config: {
            gameType: 'PATTERN_COPY',
            promptAudioUrl: audio('יוצא-דופן-צורות'),
            options: [
              { id: 'igul-1', imageUrl: img('circle-a', 'עיגול'), label: 'עיגול' },
              { id: 'igul-2', imageUrl: img('circle-b', 'עיגול'), label: 'עיגול' },
              { id: 'ribua', imageUrl: img('square', 'ריבוע'), label: 'ריבוע' },
            ],
            oddOneOutId: 'ribua',
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
              { id: 'pil', imageUrl: img('pil', 'פיל'), value: 10, label: 'פיל' },
              { id: 'achbar', imageUrl: img('achbar', 'עכבר'), value: 1, label: 'עכבר' },
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
              { id: 'k1', imageUrl: img('dots-1', 'נקודה'), label: 'אחת' },
              { id: 'k2', imageUrl: img('dots-2', 'שתיים'), label: 'שתיים' },
              { id: 'k3', imageUrl: img('dots-3', 'שלוש'), label: 'שלוש' },
            ],
            correctOptionIds: ['k3'],
          },
        },
        {
          id: uuid('a4410000', 3),
          name: 'התאמה חד-חד-ערכית — עגלת סופר',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה לגרור כל מוצר אל העגלה המתאימה לו.',
          childInstruction: 'גררו כל מוצר לעגלה שלו.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('עגלת-סופר'),
            pairs: [
              { sourceId: 'chalav', sourceImageUrl: img('chalav', 'חלב'), targetId: 'agala-chalav', targetImageUrl: img('agala-1', 'עגלה') },
              { sourceId: 'lechem', sourceImageUrl: img('lechem45', 'לחם'), targetId: 'agala-lechem', targetImageUrl: img('agala-2', 'עגלה') },
              { sourceId: 'beitzim', sourceImageUrl: img('beitzim', 'ביצים'), targetId: 'agala-beitzim', targetImageUrl: img('agala-3', 'עגלה') },
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
              { id: 'mitria', imageUrl: img('mitria', 'מטריה'), label: 'מטריה' },
              { id: 'kise', imageUrl: img('kise', 'כיסא'), label: 'כיסא' },
              { id: 'tik', imageUrl: img('tik', 'תיק'), label: 'תיק' },
            ],
            correctOptionIds: ['mitria'],
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
              { id: 'rakevet', imageUrl: img('rakevet56', 'רכבת'), label: 'רכבת' },
              { id: 'oto', imageUrl: img('oto56', 'אוטו'), label: 'אוטו' },
            ],
            correctOptionId: 'rakevet',
          },
        },
        {
          id: uuid('a5110000', 3),
          name: 'חלוקה להברות (3 הברות)',
          teacherInstruction:
            'בַּקְּשִׁי מהילד/ה לגרור עיגול אחד לכל הברה במילה. הַתְחִילִי במילים בנות 3 הברות (מְ-כוֹ-נִית).',
          childInstruction: 'גררו עיגול לכל הברה במילה.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('הברות-מכונית'),
            pairs: [
              { sourceId: 'igul-a', sourceImageUrl: img('igul', 'עיגול'), targetId: 'hevra-1', targetImageUrl: img('hev-1', 'מְ') },
              { sourceId: 'igul-b', sourceImageUrl: img('igul', 'עיגול'), targetId: 'hevra-2', targetImageUrl: img('hev-2', 'כוֹ') },
              { sourceId: 'igul-c', sourceImageUrl: img('igul', 'עיגול'), targetId: 'hevra-3', targetImageUrl: img('hev-3', 'נִית') },
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
              { id: 'adom', color: '#ef4444', label: 'אדום' },
              { id: 'kachol', color: '#3b82f6', label: 'כחול' },
              { id: 'tzahov', color: '#f59e0b', label: 'צהוב' },
            ],
            correctSequence: ['adom', 'kachol', 'tzahov', 'adom', 'kachol', 'tzahov'],
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
              { sourceId: 'tapuz', sourceImageUrl: img('tapuz', 'תפוז'), targetId: 'tzel-tapuz', targetImageUrl: img('tzel-tapuz', 'צל') },
              { sourceId: 'kelev', sourceImageUrl: img('kelev56', 'כלב'), targetId: 'tzel-kelev', targetImageUrl: img('tzel-kelev', 'צל') },
              { sourceId: 'kise', sourceImageUrl: img('kise56', 'כיסא'), targetId: 'tzel-kise', targetImageUrl: img('tzel-kise', 'צל') },
            ],
          },
        },
        {
          id: uuid('a5210000', 3),
          name: 'פאזל 8 חלקים',
          teacherInstruction: 'בַּקְּשִׁי מהילד/ה להרכיב פאזל של 8 חלקים.',
          childInstruction: 'הרכיבו את התמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-8'),
            imageUrl: img('puzzle-perach', 'פרח'),
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
              { id: 'n3', imageUrl: img('num-3', '3'), label: '3' },
              { id: 'n7', imageUrl: img('num-7', '7'), label: '7' },
              { id: 'n5', imageUrl: img('num-5', '5'), label: '5' },
              { id: 'n9', imageUrl: img('num-9', '9'), label: '9' },
            ],
            correctOptionIds: ['n7'],
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
              { id: 'kv-a', imageUrl: img('grp-4a', '4 עיגולים'), value: 4, label: 'קבוצה א' },
              { id: 'kv-b', imageUrl: img('grp-4b', '4 עיגולים'), value: 4, label: 'קבוצה ב' },
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
              { id: 'c4', imageUrl: img('cnt-4', '4'), label: 'ארבע' },
              { id: 'c5', imageUrl: img('cnt-5', '5'), label: 'חמש' },
              { id: 'c6', imageUrl: img('cnt-6', '6'), label: 'שש' },
            ],
            correctOptionIds: ['c5'],
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
