import type { PlayableSubdomain } from '../features/sessions/GamePlayer';
import { placeholderAudio, placeholderImage } from '../shared/assets/placeholder';

/**
 * M2 (§17) exit criterion: all four game types playable on an iPad from a JSON
 * fixture, no real content required. These are that fixture — placeholder images
 * and tone audio only. Real content arrives as DB rows at M3/M5 (§3.1).
 */
export const MOCK_SUBDOMAINS: PlayableSubdomain[] = [
  {
    id: 'mock-binary',
    name: 'זיהוי צליל פותח — /ב/',
    teacherInstruction: 'הושיבו את הילד מול הלוח. הקריאו: "איפה הכדור?"',
    childInstruction: 'הקשיבו וגעו בתמונה הנכונה',
    gameConfig: {
      gameType: 'BINARY_IMAGE_CHOICE',
      promptAudioUrl: placeholderAudio('איפה הכדור'),
      options: [
        { id: 'ball', imageUrl: placeholderImage('ball', 'כדור'), label: 'כדור' },
        { id: 'cat', imageUrl: placeholderImage('cat', 'חתול'), label: 'חתול' },
      ],
      correctOptionId: 'ball',
    },
  },
  {
    id: 'mock-multi',
    name: 'קטגוריות — חיות',
    teacherInstruction: 'הקריאו: "געו בכל החיות".',
    childInstruction: 'געו בכל החיות שאתם מוצאים',
    gameConfig: {
      gameType: 'MULTI_IMAGE_CHOICE',
      promptAudioUrl: placeholderAudio('געו בכל החיות'),
      options: [
        { id: 'dog', imageUrl: placeholderImage('dog', 'כלב'), label: 'כלב' },
        { id: 'chair', imageUrl: placeholderImage('chair', 'כיסא'), label: 'כיסא' },
        { id: 'bird', imageUrl: placeholderImage('bird', 'ציפור'), label: 'ציפור' },
        { id: 'cup', imageUrl: placeholderImage('cup', 'כוס'), label: 'כוס' },
        { id: 'fish', imageUrl: placeholderImage('fish', 'דג'), label: 'דג' },
      ],
      correctOptionIds: ['dog', 'bird', 'fish'],
    },
  },
  {
    id: 'mock-hotspot',
    name: 'תפיסה חזותית — איתור פרט',
    teacherInstruction: 'הקריאו: "געו בירח בתמונה".',
    childInstruction: 'געו בירח בתמונה',
    gameConfig: {
      gameType: 'HOTSPOT_IMAGE',
      promptAudioUrl: placeholderAudio('געו בירח'),
      imageUrl: placeholderImage('nightsky', 'שמי לילה'),
      targets: [
        { id: 'moon', x: 0.6, y: 0.1, width: 0.28, height: 0.28 },
        { id: 'tree', x: 0.05, y: 0.6, width: 0.3, height: 0.35 },
      ],
      correctTargetIds: ['moon'],
    },
  },
  {
    id: 'mock-drag',
    name: 'התאמה — צל לחפץ',
    teacherInstruction: 'הקריאו: "התאימו כל חפץ לצל שלו".',
    childInstruction: 'בחרו חפץ ואז געו בצל שלו',
    gameConfig: {
      gameType: 'DRAG_MATCH',
      promptAudioUrl: placeholderAudio('התאימו כל חפץ לצל'),
      pairs: [
        {
          sourceId: 'apple',
          sourceImageUrl: placeholderImage('apple', 'תפוח'),
          targetId: 'apple-shadow',
          targetImageUrl: placeholderImage('apple-shadow', 'צל תפוח'),
        },
        {
          sourceId: 'star',
          sourceImageUrl: placeholderImage('star', 'כוכב'),
          targetId: 'star-shadow',
          targetImageUrl: placeholderImage('star-shadow', 'צל כוכב'),
        },
        {
          sourceId: 'house',
          sourceImageUrl: placeholderImage('house', 'בית'),
          targetId: 'house-shadow',
          targetImageUrl: placeholderImage('house-shadow', 'צל בית'),
        },
      ],
    },
  },
  {
    id: 'mock-sequential',
    name: 'זיכרון צבעים ברצף',
    teacherInstruction: 'הקריאו: "אדום, כחול, אדום". בקשו מהילד להקיש על הצבעים באותו סדר.',
    childInstruction: 'הקישו על הצבעים לפי הסדר ששמעתם',
    gameConfig: {
      gameType: 'SEQUENTIAL_TAP',
      promptAudioUrl: placeholderAudio('אדום כחול אדום'),
      pads: [
        { id: 'red', color: '#ef4444', label: 'אדום' },
        { id: 'blue', color: '#3b82f6', label: 'כחול' },
        { id: 'green', color: '#10b981', label: 'ירוק' },
      ],
      correctSequence: ['red', 'blue', 'red'],
    },
  },
  {
    id: 'mock-comparison',
    name: 'השוואת גודל',
    teacherInstruction: 'הקריאו: "מי גדול יותר?"',
    childInstruction: 'געו בתמונה של הגדול יותר',
    gameConfig: {
      gameType: 'COMPARISON',
      promptAudioUrl: placeholderAudio('מי גדול יותר'),
      comparisonType: 'BIGGER',
      items: [
        { id: 'elephant', imageUrl: placeholderImage('elephant', 'פיל'), value: 10, label: 'פיל' },
        { id: 'mouse', imageUrl: placeholderImage('mouse', 'עכבר'), value: 1, label: 'עכבר' },
      ],
    },
  },
  {
    id: 'mock-puzzle',
    name: 'פאזל 4 חלקים',
    teacherInstruction: 'בקשו מהילד להרכיב את התמונה מהחלקים.',
    childInstruction: 'הרכיבו את התמונה',
    gameConfig: {
      gameType: 'PUZZLE',
      promptAudioUrl: placeholderAudio('הרכיבו את התמונה'),
      imageUrl: placeholderImage('puzzle-pic', 'תמונה'),
      rows: 2,
      cols: 2,
      pieceCount: 4,
    },
  },
  {
    id: 'mock-pattern',
    name: 'יוצא דופן',
    teacherInstruction: 'הקריאו: "איזו תמונה שונה מהאחרות?"',
    childInstruction: 'געו בתמונה השונה',
    gameConfig: {
      gameType: 'PATTERN_COPY',
      promptAudioUrl: placeholderAudio('איזו תמונה שונה'),
      options: [
        { id: 'circle-a', imageUrl: placeholderImage('circle-a', 'עיגול'), label: 'עיגול' },
        { id: 'circle-b', imageUrl: placeholderImage('circle-b', 'עיגול'), label: 'עיגול' },
        { id: 'square', imageUrl: placeholderImage('square', 'ריבוע'), label: 'ריבוע' },
      ],
      oddOneOutId: 'square',
    },
  },
  {
    id: 'mock-manual',
    name: 'מוטוריקה גסה — קפיצה על רגל אחת',
    teacherInstruction: 'בקשו מהילד לקפוץ 5 פעמים על רגל אחת. צפו וסמנו.',
    childInstruction: 'עכשיו ננסה לקפוץ על רגל אחת',
    gameConfig: {
      gameType: 'MANUAL_OBSERVATION',
      observationPrompt: 'האם הילד קופץ 5 פעמים ברצף על רגל אחת ללא איבוד שיווי משקל?',
    },
  },
];
