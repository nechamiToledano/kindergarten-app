/**
 * Turns whatever the network handed back into something a teacher can read.
 *
 * The API answers in English (its exceptions are written for logs and other
 * services, not for this screen) and an infra failure — a proxy 502, a
 * timed-out connection — never reaches our JSON error envelope at all. Either
 * way, nothing raw like "Bad Gateway" or "Failed to fetch" should reach the
 * UI; every error is translated to Hebrew once, here, so every screen that
 * shows `error.message` gets the same treatment for free.
 */

export interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: unknown;
}

/** Keyed by the stable `error` code some exceptions carry — sturdier than matching free text. */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  ValidationError: 'הנתונים שהוזנו אינם תקינים.',
  InvalidGameConfig: 'הגדרת המשחק אינה תקינה.',
  UnplayableSubdomains: 'חלק מהתחנות בתוכנית אינן זמינות עוד.',
};

/** Known messages from our own exceptions, translated verbatim. */
const MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Invalid credentials': 'שם המשתמש או הסיסמה שגויים.',
  'Invalid refresh token': 'תוקף ההתחברות פג. יש להתחבר מחדש.',
  'Refresh token revoked': 'תוקף ההתחברות פג. יש להתחבר מחדש.',
  'Missing bearer token': 'תוקף ההתחברות פג. יש להתחבר מחדש.',
  'Invalid or expired token': 'תוקף ההתחברות פג. יש להתחבר מחדש.',
  'Insufficient role': 'אין הרשאה לבצע פעולה זו.',
  'This operation requires a kindergarten-scoped account': 'אין הרשאה לבצע פעולה זו.',
  'This account is not attached to a network': 'החשבון אינו משויך לרשת גנים.',
  'This account is not attached to a kindergarten': 'החשבון אינו משויך לגן.',
  'That kindergarten is outside your scope': 'הגן אינו בטווח ההרשאה שלך.',
  'Child not found': 'הילד/ה לא נמצא/ה.',
  'Session not found': 'האבחון לא נמצא.',
  'Domain not found': 'התחום לא נמצא.',
  'Subdomain not found': 'תת-התחום לא נמצא.',
  'Subdomain not found or has no published version': 'תת-התחום אינו זמין כרגע.',
  'No file provided': 'לא נבחר קובץ.',
  'subdomainVersion does not match subdomain': 'התוכן עודכן. רעננו את הדף ונסו שוב.',
  'No pending plan item for that subdomain': 'התחנה הזו כבר טופלה.',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'הבקשה אינה תקינה. בדקו את הנתונים ונסו שוב.',
  401: 'תוקף ההתחברות פג. יש להתחבר מחדש.',
  403: 'אין הרשאה לבצע פעולה זו.',
  404: 'הפריט המבוקש לא נמצא.',
  409: 'הפעולה מתנגשת עם נתון קיים.',
  413: 'הקובץ גדול מדי.',
  422: 'הנתונים שהוזנו אינם תקינים.',
  429: 'יותר מדי בקשות. נסו שוב בעוד רגע.',
};

const NETWORK_ERROR_MESSAGE = 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.';
const SERVER_ERROR_MESSAGE = 'אירעה תקלה בשרת. נסו שוב בעוד רגע.';
const GENERIC_ERROR_MESSAGE = 'משהו השתבש. נסו שוב.';

/** A response with no status at all — `fetch` itself failed (offline, DNS, CORS). */
export function networkErrorMessage(): string {
  return NETWORK_ERROR_MESSAGE;
}

export function friendlyErrorMessage(status: number, body?: ApiErrorBody): string {
  // A 5xx from our own server still gets a body sometimes, but a reverse
  // proxy or gateway failure (502/503/504) never does — either way this is
  // not something the details of are worth or safe to show a teacher.
  if (status >= 500) return SERVER_ERROR_MESSAGE;
  if (body?.error && ERROR_CODE_MESSAGES[body.error]) return ERROR_CODE_MESSAGES[body.error];
  if (body?.message && MESSAGE_TRANSLATIONS[body.message]) return MESSAGE_TRANSLATIONS[body.message];
  return STATUS_MESSAGES[status] ?? GENERIC_ERROR_MESSAGE;
}
