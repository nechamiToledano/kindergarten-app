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

/** A line the narrator speaks aloud (browser TTS) until a real recording exists. */
const say = (text: string): string => `say:${encodeURIComponent(text)}`;

export interface SubdomainSpec {
  id: string;
  name: string;
  teacherInstruction: string;
  childInstruction: string;
  config: GameConfig;
  /**
   * Spec: several subdomains show a worked example before the scored trial
   * ("בפעם הראשונה הגננת מדגימה", "לפני הבדיקה תוצג דוגמא"). When present, the
   * child sees this config played (via the same component, ungraded — no
   * RawAnswer is recorded) before the real `config` starts.
   */
  demoConfig?: GameConfig;
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
        'הַצִּיגִי שתי תמונות. בַּקְּשִׁי מהילד/ה לבחור את התמונה שֶׁשְּׁמָהּ מסתיים בצליל /ם/.',
      childInstruction: 'איזו תמונה מסתיימת בצליל ם? ים או כלב?',
      config: {
        gameType: 'BINARY_IMAGE_CHOICE',
        promptAudioUrl: audio('צליל-סוגר-מם'),
        options: [
          { id: 'sea', imageUrl: '/assets/object-sea.png', label: 'ים' },
          { id: 'dog', imageUrl: '/assets/object-dog.png', label: 'כלב' },
        ],
        correctOptionId: 'sea',
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
      name: 'זיהוי חריזה',
      teacherInstruction:
        'הַצִּיגִי שני צמדי מילים: אחד מתחרז ("בלון-חלון") ואחד לא ("כיפה-שולחן"). בַּקְּשִׁי מהילד/ה להצביע על הצמד המתחרז.',
      childInstruction: 'איזה צמד מילים מתחרז?',
      config: {
        gameType: 'BINARY_IMAGE_CHOICE',
        promptAudioUrl: audio('חריזה-בלון-חלון-כיפה-שולחן'),
        options: [
          { id: 'balloon-window', imageUrl: '/assets/rhyme-balloon-window.png', label: 'בלון—חלון' },
          { id: 'kippah-table', imageUrl: '/assets/rhyme-kippah-table.png', label: 'כיפה—שולחן' },
        ],
        correctOptionId: 'balloon-window',
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
        'אִמְרִי את שמות שלוש החיות בלי להדגיש צליל, ואז אִמְרִי רק את הצליל הפותח של אחת מהן. בַּקְּשִׁי מהילד/ה להצביע על החיה המתאימה. בכל לחיצה נכונה, השמיעי את שם החיה שוב בהדגשה על הצליל הפותח (למשל "פ-פ-פ-פרה") — זה מה שמלמד את הילד/ה לבודד את הצליל.',
      childInstruction: 'איזו חיה מתחילה בצליל ששמעתם?',
      config: {
        gameType: 'MULTI_IMAGE_CHOICE',
        promptAudioUrl: audio('צליל-פותח-פרה-חמור-גירפה'),
        options: [
          { id: 'cow', imageUrl: '/assets/object-cow.png', label: 'פרה', feedbackAudioUrl: audio('פ-פ-פ-פרה') },
          { id: 'donkey', imageUrl: '/assets/animal-donkey.png', label: 'חמור', feedbackAudioUrl: audio('ח-ח-ח-חמור') },
          { id: 'giraffe', imageUrl: '/assets/animal-giraffe.png', label: 'ג׳ירפה', feedbackAudioUrl: audio('ג-ג-ג-גירפה') },
        ],
        correctOptionIds: ['cow'],
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
            'המסך נשאר אותו מסך: קודם נשמע קול של בעל חיים (מוווו). אחרי רגע מופיעות שתי התמונות (פרה וברווז), והקול שואל "מי זה היה?", והילד/ה בוחר/ת. כשצריך לחזור: שוב אותו סדר — הקול מושמע, התמונה מוצגת ונעלמת. בניסיון האחרון, אם הילד/ה לא יודע/ת, הקול מושמע והתמונות נשארות על המסך (לא נעלמות) והילד/ה בוחר/ת.',
          childInstruction: 'בוא נקשיב לקול.',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: '/assets/audio/sfx-cow.mp3',
            sequenceAudioUrls: [say('מי זה היה?')],
            revealAfterAudio: true,
            options: [
              { id: 'cow', imageUrl: '/assets/object-cow.png', label: 'פרה' },
              { id: 'duck', imageUrl: '/assets/object-duck.png', label: 'ברווז' },
            ],
            correctOptionId: 'cow',
          },
        },
        {
          id: uuid('a3210000', 2),
          name: 'זיהוי צלילים — חלק ב',
          teacherInstruction:
            'על המסך תמונה של בעל חיים (פרה / ברווז) ושני רמקולים, כל אחד משמיע צליל אחר (למשל כלב וחתול). הילד/ה מקשיב/ה לקול, ורק כששומע/ת את הקול שמתאים לתמונה — לוחץ/ת עליה. בשלב הראשון: "בוא נקשיב לקול" ואז שואלים "זה מתאים?", ואם מתאים — מצביעים על התמונה.',
          childInstruction: 'בוא נקשיב לקול. זה מתאים לתמונה?',
          config: {
            gameType: 'SOUND_PICK',
            promptAudioUrl: audio('איזה-צליל-מתאים'),
            imageUrl: '/assets/object-cow.png',
            options: [
              { id: 'cow', audioUrl: '/assets/audio/sfx-cow.mp3' },
              { id: 'duck', audioUrl: '/assets/audio/sfx-duck.wav' },
            ],
            correctOptionId: 'cow',
          },
        },
        {
          id: uuid('a3210000', 3),
          name: 'זיכרון סדר צלילים',
          teacherInstruction:
            'הַשְׁמִיעִי שני קולות של בעלי חיים ברצף (פרה ואז כלב). בַּקְּשִׁי מהילד/ה לבחור מי השמיע קול ראשון.',
          childInstruction: 'איזה בעל חיים שמעתם קודם?',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: '/assets/audio/sfx-cow.mp3',
            sequenceAudioUrls: ['/assets/audio/sfx-dog.mp3'],
            options: [
              { id: 'cow', imageUrl: '/assets/object-cow.png', label: 'פרה' },
              { id: 'dog', imageUrl: '/assets/object-dog.png', label: 'כלב' },
            ],
            correctOptionId: 'cow',
          },
        },
        {
          id: uuid('a3210000', 4),
          name: 'הוראה שמיעתית פשוטה — שלב א',
          teacherInstruction:
            'על המסך שולחן עם שתי צלחות, והמערכת אומרת "שים את התפוח בצלחת". הילד/ה גורר/ת את התפוח לאחת הצלחות. אפשר גם לתת הוראה של שלב אחד בחפצים אמיתיים ולעבור ישירות לדירוג. דַּרְגִי לפי הבנה וביצוע.',
          childInstruction: 'הקשיבו וגררו את התפוח למקום הנכון.',
          config: {
            gameType: 'INSTRUCTION_PLACE',
            promptAudioUrl: say('שים את התפוח בצלחת'),
            sceneImageUrl: '/assets/scene-table-plates.png',
            items: [{ id: 'apple', imageUrl: '/assets/item-apple.png', label: 'תפוח' }],
            targets: [
              { id: 'plate-left', x: 0.17, y: 0.3, width: 0.28, height: 0.22 },
              { id: 'plate-right', x: 0.56, y: 0.3, width: 0.28, height: 0.22 },
            ],
            steps: [{ itemId: 'apple', targetIds: ['plate-left', 'plate-right'] }],
          },
        },
        {
          id: uuid('a3210000', 5),
          name: 'הוראה שמיעתית פשוטה — שלב ב (שתי הוראות)',
          teacherInstruction:
            'על המסך שולחן עם סלסלה, והמערכת אומרת "שים את התפוח ואת הלחם בסלסלה". הילד/ה גורר/ת את שני הפריטים לסלסלה, קודם התפוח ואחר כך הלחם. אפשר גם לתת הוראה של שני שלבים בחפצים אמיתיים ולעבור ישירות לדירוג. דַּרְגִי לפי הבנה וביצוע של שני השלבים ובסדר הנכון.',
          childInstruction: 'הקשיבו וגררו את התפוח ואת הלחם לסלסלה.',
          config: {
            gameType: 'INSTRUCTION_PLACE',
            promptAudioUrl: say('שים את התפוח ואת הלחם בסלסלה'),
            sceneImageUrl: '/assets/scene-table-basket.png',
            items: [
              { id: 'apple', imageUrl: '/assets/item-apple.png', label: 'תפוח' },
              { id: 'bread', imageUrl: '/assets/item-bread.png', label: 'לחם' },
            ],
            targets: [{ id: 'basket', x: 0.26, y: 0.22, width: 0.48, height: 0.4 }],
            steps: [
              { itemId: 'apple', targetIds: ['basket'] },
              { itemId: 'bread', targetIds: ['basket'] },
            ],
            ordered: true,
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
            'פעילות פיזית (סלסלת חפצים). תני לילד/ה חפץ ביד, ובַקְּשִׁי למצוא בסל את אותו החפץ בדיוק (לא רק זוג דומה בתוך הסל). דַּרְגִי.',
          childInstruction: 'קיבלתם חפץ ביד — מצאו בסל את אותו החפץ בדיוק.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה מוצא/ת בסל את החפץ הזהה לחפץ שקיבל/ה ביד.',
          },
        },
        {
          id: uuid('a3310000', 2),
          name: 'התאמת תמונות',
          teacherInstruction:
            'בעמוד יש תמונות, ויש שתי דרכי ביצוע: (1) בַּקְּשִׁי מהילד/ה להצביע על שתי התמונות שהן אותו דבר; (2) בַּקְּשִׁי מהילד/ה לגרור את התמונה אל הזוג שלה, התמונה שהיא אותו דבר. דַּרְגִי לפי הביצוע.',
          childInstruction: 'תראו לי אותו דבר.',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: say('תראו לי אותו דבר'),
            sampleImageUrl: '/assets/object-ball.png',
            options: [
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
          teacherInstruction:
            'בַּתְּמוּנָה גינה עם כלב, כדור ופח. בַּקְּשִׁי מהילד/ה להצביע, כל פעם, על פריט שאת בוחרת מהתמונה (כאן: הפח).',
          childInstruction: 'תראו לי את הפח.',
          config: {
            gameType: 'HOTSPOT_IMAGE',
            promptAudioUrl: say('תראו לי את הפח'),
            imageUrl: '/assets/hotspot-park-dog.png',
            // Order matters: the plugin takes the first rectangle that contains the tap,
            // so small/foreground objects come before the large tree box.
            targets: [
              { id: 'trash-can', x: 0.675, y: 0.44, width: 0.255, height: 0.475 },
              { id: 'dog', x: 0.355, y: 0.465, width: 0.24, height: 0.44 },
              { id: 'ball', x: 0.1, y: 0.635, width: 0.205, height: 0.285 },
              { id: 'tree', x: 0, y: 0, width: 0.345, height: 0.63 },
            ],
            correctTargetIds: ['trash-can'],
          },
        },
        {
          id: uuid('a3310000', 6),
          name: 'פאזל חלק אחד',
          teacherInstruction:
            'על המסך יש שקע בצורת צללית וחיה לגרירה אליו. אם עדיף לך להגיש פאזל עץ של חלק אחד, הגישי אותו ולחצי על "מעבר ישיר לדירוג" במסך הפתיחה. דַּרְגִי: קיים (עצמאי) / קיים עם תיווך (בעזרת רמז/הדגמה) / קיים חלקית / לא קיים.',
          childInstruction: 'הכניסו את החיה למקום שלה.',
          config: {
            gameType: 'INSET_PUZZLE',
            promptAudioUrl: audio('פאזל-חלק-אחד-פרה'),
            imageUrl: '/assets/inset-cow-wood.png',
            boardUrl: '/assets/board-cow-wood.jpg',
            hole: { x: 0.222, y: 0.273, width: 0.55, height: 0.447 },
          },
        },
        {
          id: uuid('a3310000', 8),
          name: 'פאזל 2 חלקים',
          teacherInstruction:
            'הפאזל מוצג על המסך: החלקים מסודרים עם רווח ביניהם, והילד/ה מצמיד/ה אותם עד שנוצרת תמונה. אם עדיף לך להגיש פאזל עץ אמיתי, הגישי פאזל של 2 חלקים ו לחצי על "מעבר ישיר לדירוג" במסך הפתיחה. דַּרְגִי: קיים (עצמאי) / קיים עם תיווך (בעזרת רמז/הדגמה) / קיים חלקית / לא קיים.',
          childInstruction: 'הצמידו את החלקים זה לזה כדי ליצור תמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-2-חיפושית'),
            imageUrl: '/assets/puzzle-butterfly.png',
            rows: 1,
            cols: 2,
            pieceCount: 2,
          },
        },
        {
          id: uuid('a3310000', 4),
          name: 'פאזל 4 חלקים',
          teacherInstruction:
            'הפאזל מוצג על המסך: החלקים מסודרים עם רווח ביניהם, והילד/ה מצמיד/ה אותם עד שנוצרת תמונה. אם עדיף לך להגיש פאזל עץ אמיתי, הגישי פאזל של 4 חלקים ו לחצי על "מעבר ישיר לדירוג" במסך הפתיחה. דַּרְגִי: קיים (עצמאי) / קיים עם תיווך (בעזרת רמז/הדגמה) / קיים חלקית / לא קיים.',
          childInstruction: 'הצמידו את החלקים זה לזה כדי ליצור תמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-4-פרה'),
            imageUrl: '/assets/puzzle-dog.png',
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
          name: 'ספירה',
          teacherInstruction:
            'יד על המסך דופקת 3 פעמים. אחר כך תורו של הילד/ה: דופק/ת 3 פעמים — על המסך, או על שולחן או תוף אמיתי — ובזמן הזה קול רגוע סופר לאט "אחת, שתיים, שלוש" כדי לתת קצב. האפליקציה לא שומעת דפיקות על שולחן, ולכן דפיקה שלא על המסך אינה נחשבת שגיאה — דַּרְגִי אַתְּ בסוף: האם הילד/ה דפק/ה במספר הנכון ועצר/ה בזמן.',
          childInstruction: 'הקשיבו כמה פעמים היד דפקה, ואז דפקו גם אתם — על המסך או על השולחן.',
          config: {
            gameType: 'KNOCK_ECHO',
            promptAudioUrl: audio('דפיקות-שלוש'),
            knockCount: 3,
          },
        },
        {
          id: uuid('a3410000', 2),
          name: 'הרבה / מעט',
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
          id: uuid('a3410000', 4),
          name: 'גדול / קטן',
          teacherInstruction: 'הַצִּיגִי שני עצמים בגודל שונה. בַּקְּשִׁי מהילד/ה לבחור את הגדול.',
          childInstruction: 'מי גדול יותר?',
          config: {
            gameType: 'COMPARISON',
            promptAudioUrl: audio('מי-גדול-3-4'),
            comparisonType: 'BIGGER',
            items: [
              { id: 'big', imageUrl: '/assets/animal-elephant.png', value: 2, label: 'גדול' },
              { id: 'small', imageUrl: '/assets/animal-elephant.png', value: 1, label: 'קטן' },
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
          name: 'זיכרון סדר צלילים — שני בעלי חיים',
          teacherInstruction:
            'הַשְׁמִיעִי קול של כלב ואז קול של חתול. בַּקְּשִׁי מהילד/ה להקיש על בעלי החיים לפי הסדר ששמע/ה — קודם כלב, ואז חתול.',
          childInstruction: 'איזה בעל חיים שמעתם קודם, ומי אחר כך? הקישו לפי הסדר.',
          config: {
            gameType: 'SEQUENTIAL_TAP',
            promptAudioUrl: '/assets/audio/sfx-dog.mp3',
            sequenceAudioUrls: ['/assets/audio/sfx-cat.mp3'],
            pads: [
              { id: 'dog', color: '#b23a3a', label: 'כלב', imageUrl: '/assets/object-dog.png' },
              { id: 'cat', color: '#3e6e8e', label: 'חתול', imageUrl: '/assets/animal-cat.png' },
            ],
            correctSequence: ['dog', 'cat'],
          },
        },
        {
          id: uuid('a4210000', 3),
          name: 'זיכרון צבעים ברצף — שלב א (שני צבעים)',
          teacherInstruction:
            'הַשְׁמִיעִי הוראה קולית של שני צבעים ("קודם תלחץ/י על הכחול, ואז על האדום"). אם הילד/ה לוחץ/ת על צבע שגוי, יופיע אפקט שגיאה והוא/היא לא יוכל/תוכל להתקדם עד שילחץ/תלחץ נכון.',
          childInstruction: 'הקישו על הצבעים לפי הסדר ששמעתם.',
          config: {
            gameType: 'SEQUENTIAL_TAP',
            promptAudioUrl: audio('רצף-צבעים-כחול-אדום'),
            validateEachStep: true,
            pads: [
              { id: 'red', color: '#ef4444', label: 'אדום' },
              { id: 'blue', color: '#3b82f6', label: 'כחול' },
            ],
            correctSequence: ['blue', 'red'],
          },
        },
        {
          id: uuid('a4210000', 4),
          name: 'זיכרון צבעים ברצף — שלב ב (שלושה צבעים)',
          teacherInstruction:
            'הַשְׁמִיעִי הוראה קולית של רצף שלושה צבעים שונים ("כחול, אדום, ירוק"). אם הילד/ה לוחץ/ת על צבע שגוי, יופיע אפקט שגיאה והוא/היא לא יוכל/תוכל להתקדם עד שילחץ/תלחץ נכון; לחיצה נכונה משמיעה צליל שמח ומאפשרת המשך.',
          childInstruction: 'הקישו על הצבעים לפי הסדר ששמעתם.',
          config: {
            gameType: 'SEQUENTIAL_TAP',
            promptAudioUrl: audio('רצף-צבעים-כחול-אדום-ירוק'),
            validateEachStep: true,
            pads: [
              { id: 'red', color: '#ef4444', label: 'אדום' },
              { id: 'blue', color: '#3b82f6', label: 'כחול' },
              { id: 'green', color: '#10b981', label: 'ירוק' },
            ],
            correctSequence: ['blue', 'red', 'green'],
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
            'הראי לילד/ה את חמשת העיגולים (אדום-צהוב-אדום-צהוב-אדום) והסבירי שזו "מתכונת". בַּקְּשִׁי להמשיך את הרצף בארבע המשבצות הריקות, לפי הסדר, מתוך הצבעים למטה.',
          childInstruction: 'המשיכו את הרצף — הקישו על הצבעים לפי הסדר.',
          config: {
            gameType: 'PATTERN_SEQUENCE',
            promptAudioUrl: audio('השלמת-רצף-צבעים'),
            palette: [
              { id: 'red', color: '#ef4444', label: 'אדום' },
              { id: 'yellow', color: '#f59e0b', label: 'צהוב' },
            ],
            prefix: ['red', 'yellow', 'red', 'yellow', 'red'],
            blankCount: 4,
            correctContinuation: ['yellow', 'red', 'yellow', 'red'],
          },
        },
        {
          id: uuid('a4310000', 2),
          name: 'דמות ורקע — פריט בתמונה מורכבת',
          teacherInstruction:
            'בַּתְּמוּנָה פארק עמוס. בַּקְּשִׁי מהילד/ה להצביע, כל פעם, על פריט שאת בוחרת מהתמונה (כאן: החתול).',
          childInstruction: 'תראו לי חתול.',
          config: {
            gameType: 'HOTSPOT_IMAGE',
            promptAudioUrl: say('תראו לי חתול'),
            imageUrl: '/assets/hotspot-park-swing.png',
            // Foreground/small objects first (first containing rectangle wins).
            targets: [
              { id: 'banana', x: 0.825, y: 0.625, width: 0.05, height: 0.075 },
              { id: 'bin', x: 0.82, y: 0.615, width: 0.14, height: 0.325 },
              { id: 'swing', x: 0.43, y: 0.48, width: 0.145, height: 0.235 },
              { id: 'boy', x: 0.645, y: 0.485, width: 0.175, height: 0.4 },
              { id: 'cat', x: 0.17, y: 0.65, width: 0.185, height: 0.31 },
              { id: 'tree', x: 0, y: 0.02, width: 0.36, height: 0.62 },
            ],
            correctTargetIds: ['cat'],
          },
        },
        {
          id: uuid('a4310000', 3),
          name: 'פאזל 6 חלקים',
          teacherInstruction:
            'הפאזל מוצג על המסך: החלקים מסודרים עם רווח ביניהם, והילד/ה מצמיד/ה אותם עד שנוצרת תמונה. אם עדיף לך להגיש פאזל עץ אמיתי, הגישי פאזל של 6 חלקים ו לחצי על "מעבר ישיר לדירוג" במסך הפתיחה. דַּרְגִי: קיים (עצמאי) / קיים עם תיווך (בעזרת רמז/הדגמה) / קיים חלקית / לא קיים.',
          childInstruction: 'הצמידו את החלקים זה לזה כדי ליצור תמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-6-פרח'),
            imageUrl: '/assets/puzzle-lion.png',
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
              { id: 'big', imageUrl: '/assets/animal-elephant.png', value: 2, label: 'גדול' },
              { id: 'small', imageUrl: '/assets/animal-elephant.png', value: 1, label: 'קטן' },
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
          teacherInstruction:
            'בַּקְּשִׁי מהילד/ה לגרור כל מוצר לתוך אחת מארבע העגלות, מוצר אחד לכל עגלה — אין עגלה "נכונה" ספציפית לכל מוצר, כל שיוך של מוצר אחד לכל עגלה תקין.',
          childInstruction: 'הקישו על מוצר למעלה, ואז הקישו על עגלה ריקה למטה — מוצר אחד לכל עגלה.',
          config: {
            gameType: 'DRAG_MATCH',
            promptAudioUrl: audio('עגלת-סופר'),
            matchMode: 'BIJECTION',
            pairs: [
              { sourceId: 'milk', sourceImageUrl: '/assets/food-milk.png', targetId: 'cart-1', targetImageUrl: '/assets/food-cart.png' },
              { sourceId: 'bread', sourceImageUrl: '/assets/food-bread.png', targetId: 'cart-2', targetImageUrl: '/assets/food-cart.png' },
              { sourceId: 'eggs', sourceImageUrl: '/assets/food-eggs.png', targetId: 'cart-3', targetImageUrl: '/assets/food-cart.png' },
              { sourceId: 'apple', sourceImageUrl: '/assets/object-apple.png', targetId: 'cart-4', targetImageUrl: '/assets/food-cart.png' },
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
          id: uuid('a5110000', 8),
          name: 'זיהוי חריזה',
          teacherInstruction:
            'הַצִּיגִי שני צמדי מילים: אחד מתחרז ("בלון-חלון") ואחד לא ("כיפה-שולחן"). בַּקְּשִׁי מהילד/ה להצביע על הצמד המתחרז.',
          childInstruction: 'איזה צמד מילים מתחרז?',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('חריזה-בלון-חלון-כיפה-שולחן-5-6'),
            options: [
              { id: 'balloon-window', imageUrl: '/assets/rhyme-balloon-window.png', label: 'בלון—חלון' },
              { id: 'kippah-table', imageUrl: '/assets/rhyme-kippah-table.png', label: 'כיפה—שולחן' },
            ],
            correctOptionId: 'balloon-window',
          },
          demoConfig: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('דוגמה-חריזה-דוב-אוהב'),
            options: [
              { id: 'demo-rhyme', imageUrl: '/assets/rhyme-balloon-window.png', label: 'דוב—אוהב (מתחרז)' },
              { id: 'demo-no-rhyme', imageUrl: '/assets/rhyme-kippah-table.png', label: 'שולחן—כיסא (לא מתחרז)' },
            ],
            correctOptionId: 'demo-rhyme',
          },
        },
        {
          id: uuid('a5110000', 1),
          name: 'צליל פותח — זיהוי מתוך שלוש',
          teacherInstruction:
            'בפעם הראשונה, הדגימי בעצמך: הַשְׁמִיעִי את הצליל ולחצי בעצמך על התמונה הנכונה. בפעם השנייה, הַשְׁמִיעִי את הצליל /מ/ ובַקְּשִׁי מהילד/ה לבחור מבין שלוש תמונות את זו שֶׁשְּׁמָהּ מתחיל ב-/מ/, ואז לשַׁיֵּם אותה בעצמו/ה.',
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
          demoConfig: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('דוגמה-צליל-פותח-ת'),
            options: [
              { id: 'demo-apple', imageUrl: '/assets/object-apple.png', label: 'תפוח' },
              { id: 'demo-doll', imageUrl: '/assets/object-doll.png', label: 'בובה' },
              { id: 'demo-ball', imageUrl: '/assets/object-ball.png', label: 'כדור' },
            ],
            correctOptionIds: ['demo-apple'],
          },
        },
        {
          id: uuid('a5110000', 7),
          name: 'צליל פותח — שיום',
          teacherInstruction:
            'הַצִּיגִי תמונה ובַקְּשִׁי מהילד/ה לומר בקול איך המילה מתחילה (למשל תמונת פרה — "פ"). דַּרְגִי לפי דיוק השיום, בנפרד מהזיהוי.',
          childInstruction: 'איך מתחילה המילה? אמרו את הצליל.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה משַׁיֵּם את הצליל הפותח של מילה נתונה בעצמו/ה.',
          },
        },
        {
          id: uuid('a5110000', 2),
          name: 'מילה ארוכה / קצרה',
          teacherInstruction:
            'הסבירי לילד/ה: מילה ארוכה זה כמו רכבת ארוכה, מילה קצרה זה כמו אוטו. אִמְרִי מילה (למשל "תַּרְנְגוֹלֶת") ובַקְּשִׁי מהילד/ה ללחוץ על הרכבת אם המילה ארוכה, או על האוטו אם היא קצרה.',
          childInstruction: 'הקשיבו למילה — אם היא ארוכה הקישו על הרכבת, ואם קצרה הקישו על האוטו.',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('מילה-תרנגולת'),
            options: [
              { id: 'train', imageUrl: '/assets/object-train.png', label: 'רכבת — מילה ארוכה' },
              { id: 'car', imageUrl: '/assets/car-a.png', label: 'אוטו — מילה קצרה' },
            ],
            correctOptionId: 'train',
          },
        },
        {
          id: uuid('a5110000', 5),
          name: 'מילה ארוכה / קצרה — מילה קצרה',
          teacherInstruction:
            'אותה פעילות עם מילה קצרה (למשל "כַּד"). בַּקְּשִׁי מהילד/ה ללחוץ על הרכבת אם המילה ארוכה, או על האוטו אם היא קצרה.',
          childInstruction: 'הקשיבו למילה — אם היא ארוכה הקישו על הרכבת, ואם קצרה הקישו על האוטו.',
          config: {
            gameType: 'BINARY_IMAGE_CHOICE',
            promptAudioUrl: audio('מילה-כד'),
            options: [
              { id: 'train', imageUrl: '/assets/object-train.png', label: 'רכבת — מילה ארוכה' },
              { id: 'car', imageUrl: '/assets/car-a.png', label: 'אוטו — מילה קצרה' },
            ],
            correctOptionId: 'car',
          },
        },
        {
          id: uuid('a5110000', 3),
          name: 'חלוקה להברות (3 הברות)',
          teacherInstruction:
            'הראי לילד/ה תמונה של בננה. בַּקְּשִׁי לגרור עיגול אחד לכל ריבוע ריק תוך אמירת ההברה בקול (בַּ-נָ-נָה) — יש עיגול אחד מיותר במתכוון.',
          childInstruction: 'תגידו את המילה בהברות וגררו עיגול לכל ריבוע — בּ-נ-נה.',
          config: {
            gameType: 'SYLLABLE_COUNT',
            promptAudioUrl: audio('הברות-בננה'),
            wordImageUrl: '/assets/syllable-banana.png',
            slotCount: 3,
            tokenCount: 4,
          },
        },
        {
          id: uuid('a5110000', 6),
          name: 'חלוקה להברות (4 הברות)',
          teacherInstruction:
            'הראי לילד/ה תמונה של קרוסלה. בַּקְּשִׁי לגרור עיגול אחד לכל ריבוע ריק תוך אמירת ההברה בקול (קָ-רוּ-סֶ-לָה) — יש עיגול אחד מיותר במתכוון.',
          childInstruction: 'תגידו את המילה בהברות וגררו עיגול לכל ריבוע — ק-רו-סה-לה.',
          config: {
            gameType: 'SYLLABLE_COUNT',
            promptAudioUrl: audio('הברות-קרוסלה'),
            wordImageUrl: '/assets/syllable-carousel.png',
            slotCount: 4,
            tokenCount: 5,
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
            'הראי לילד/ה את חמשת העיגולים (אדום-צהוב-כחול-אדום-צהוב) והסבירי שזו "מתכונת" שחוזרת על עצמה. בַּקְּשִׁי להמשיך את הרצף בשש המשבצות הריקות, לפי הסדר.',
          childInstruction: 'המשיכו את הרצף — הקישו על הצבעים בסדר.',
          config: {
            gameType: 'PATTERN_SEQUENCE',
            promptAudioUrl: audio('רצף-3-צבעים'),
            palette: [
              { id: 'red', color: '#ef4444', label: 'אדום' },
              { id: 'yellow', color: '#f59e0b', label: 'צהוב' },
              { id: 'blue', color: '#3b82f6', label: 'כחול' },
            ],
            prefix: ['red', 'yellow', 'blue', 'red', 'yellow'],
            blankCount: 6,
            correctContinuation: ['blue', 'red', 'yellow', 'blue', 'red', 'yellow'],
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
          teacherInstruction:
            'הפאזל מוצג על המסך: החלקים מסודרים עם רווח ביניהם, והילד/ה מצמיד/ה אותם עד שנוצרת תמונה. אם עדיף לך להגיש פאזל עץ אמיתי, הגישי פאזל של 8 חלקים ו לחצי על "מעבר ישיר לדירוג" במסך הפתיחה. דַּרְגִי: קיים (עצמאי) / קיים עם תיווך (בעזרת רמז/הדגמה) / קיים חלקית / לא קיים.',
          childInstruction: 'הצמידו את החלקים זה לזה כדי ליצור תמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-8-בית'),
            imageUrl: '/assets/puzzle-zebra.png',
            rows: 2,
            cols: 4,
            pieceCount: 8,
          },
        },
        {
          id: uuid('a5210000', 4),
          name: 'פאזל 10 חלקים',
          teacherInstruction:
            'הפאזל מוצג על המסך: החלקים מסודרים עם רווח ביניהם, והילד/ה מצמיד/ה אותם עד שנוצרת תמונה. אם עדיף לך להגיש פאזל עץ אמיתי, הגישי פאזל של 10 חלקים ו לחצי על "מעבר ישיר לדירוג" במסך הפתיחה. דַּרְגִי: קיים (עצמאי) / קיים עם תיווך (בעזרת רמז/הדגמה) / קיים חלקית / לא קיים.',
          childInstruction: 'הצמידו את החלקים זה לזה כדי ליצור תמונה.',
          config: {
            gameType: 'PUZZLE',
            promptAudioUrl: audio('פאזל-10-שמש-ובית'),
            imageUrl: '/assets/puzzle-fish.png',
            rows: 2,
            cols: 5,
            pieceCount: 10,
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
          id: uuid('a5310000', 7),
          name: 'זיהוי ספרות — שיום',
          teacherInstruction:
            'הַצִּיגִי ספרה בודדת ובַקְּשִׁי מהילד/ה לשַׁיֵּם אותה בקול. דַּרְגִי לפי דיוק השיום, בנפרד מהזיהוי.',
          childInstruction: 'איזו ספרה זו? אמרו את שמה.',
          config: {
            gameType: 'MANUAL_OBSERVATION',
            observationPrompt: 'הילד/ה משַׁיֵּם ספרות בודדות מ-1 עד 10 בעצמו/ה.',
          },
        },
        {
          id: uuid('a5310000', 2),
          name: 'גדול / קטן / שווה — השוואת כמויות (שוות)',
          teacherInstruction:
            'הַצִּיגִי שתי קבוצות עצמים בכמות זהה. בַּקְּשִׁי מהילד/ה להקיש "שווה".',
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
          id: uuid('a5310000', 5),
          name: 'גדול / קטן / שווה — השוואת כמויות (לא שוות)',
          teacherInstruction:
            'הַצִּיגִי שתי קבוצות עצמים בכמות שונה. בַּקְּשִׁי מהילד/ה להקיש על הקבוצה עם יותר עצמים, ולא על "שווה" — בודקת שהילד/ה מבחין/ה בין שווה ללא-שווה, לא רק בוחר/ת "שווה" תמיד.',
          childInstruction: 'האם הכמויות שוות, או שבאחת יש יותר?',
          config: {
            gameType: 'COMPARISON',
            promptAudioUrl: audio('שווה-או-יותר-לא-שוות'),
            comparisonType: 'EQUAL',
            items: [
              { id: 'group-c', imageUrl: '/assets/count-4.png', value: 4, label: 'קבוצה א' },
              { id: 'group-d', imageUrl: '/assets/count-5.png', value: 5, label: 'קבוצה ב' },
            ],
          },
        },
        {
          id: uuid('a5310000', 6),
          name: 'גדול / קטן — השוואת כמויות',
          teacherInstruction:
            'הַצִּיגִי שתי קבוצות עצמים בכמות שונה. בַּקְּשִׁי מהילד/ה לבחור את הקבוצה עם יותר עצמים.',
          childInstruction: 'איזו קבוצה גדולה יותר?',
          config: {
            gameType: 'COMPARISON',
            promptAudioUrl: audio('קבוצה-גדולה-יותר'),
            comparisonType: 'BIGGER',
            items: [
              { id: 'group-e', imageUrl: '/assets/count-three-apples.png', value: 3, label: 'קבוצה א' },
              { id: 'group-f', imageUrl: '/assets/count-5.png', value: 5, label: 'קבוצה ב' },
            ],
          },
        },
        {
          id: uuid('a5310000', 3),
          name: 'תפיסת כמות עד 5',
          teacherInstruction:
            'הַשְׁמִיעִי "חמש". בַּקְּשִׁי מהילד/ה לבחור מבין ארבעה כרטיסים (בטווח אחת עד חמש) את זה עם חמישה עצמים.',
          childInstruction: 'איפה חמש?',
          config: {
            gameType: 'MULTI_IMAGE_CHOICE',
            promptAudioUrl: audio('כמות-חמש'),
            options: [
              { id: 'count-1', imageUrl: '/assets/count-1.png', label: 'אחת' },
              { id: 'count-3', imageUrl: '/assets/count-three-apples.png', label: 'שלוש' },
              { id: 'count-4', imageUrl: '/assets/count-4.png', label: 'ארבע' },
              { id: 'count-5', imageUrl: '/assets/count-5.png', label: 'חמש' },
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
