import type { Rating, RawAnswer } from '@kga/contracts';

/**
 * Spec §5 session flow, as a pure reducer (§8). No React, no Nest, no DB.
 * A single subdomain run. `attemptsCount` is per-subdomain and starts at 0.
 */
export const MAX_ATTEMPTS = 3;

export type SessionPhase =
  | 'TeacherInstruction'
  | 'ChildInstruction'
  | 'Playing'
  | 'CorrectFeedback'
  | 'WrongFeedback'
  | 'Exhausted'
  | 'RatingSuccess'
  | 'RatingFailure'
  | 'Done';

export interface SessionState {
  phase: SessionPhase;
  attempts: number;
  rawAnswers: RawAnswer[];
  rating: Rating | null;
  teacherNote: string | null;
}

export type SessionEvent =
  | { type: 'START' } // teacher taps Start (user gesture — unlocks audio, §11.4)
  | { type: 'CHILD_AUDIO_FINISHED' }
  | { type: 'ANSWER'; correct: boolean; value: unknown; at: string }
  | { type: 'CONTINUE_AFTER_WRONG' }
  // Advances a feedback phase that has no user input of its own (CorrectFeedback,
  // Exhausted). The teacher sees the feedback; the UI ticks it forward on a timer.
  | { type: 'ADVANCE' }
  | { type: 'RATE'; rating: Rating; teacherNote?: string | null };

export function initialSessionState(): SessionState {
  return { phase: 'TeacherInstruction', attempts: 0, rawAnswers: [], rating: null, teacherNote: null };
}

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (state.phase) {
    case 'TeacherInstruction':
      return event.type === 'START' ? { ...state, phase: 'ChildInstruction' } : state;

    case 'ChildInstruction':
      return event.type === 'CHILD_AUDIO_FINISHED' ? { ...state, phase: 'Playing' } : state;

    case 'Playing': {
      if (event.type !== 'ANSWER') return state;
      const attempts = state.attempts + 1;
      const rawAnswers = [
        ...state.rawAnswers,
        { attempt: attempts, at: event.at, value: event.value, correct: event.correct },
      ];
      if (event.correct) return { ...state, phase: 'CorrectFeedback', attempts, rawAnswers };
      if (attempts >= MAX_ATTEMPTS) return { ...state, phase: 'Exhausted', attempts, rawAnswers };
      return { ...state, phase: 'WrongFeedback', attempts, rawAnswers };
    }

    case 'WrongFeedback':
      return event.type === 'CONTINUE_AFTER_WRONG' ? { ...state, phase: 'Playing' } : state;

    case 'CorrectFeedback':
      return event.type === 'ADVANCE' ? { ...state, phase: 'RatingSuccess' } : state;

    case 'Exhausted':
      return event.type === 'ADVANCE' ? { ...state, phase: 'RatingFailure' } : state;

    case 'RatingSuccess':
      // The teacher always rates manually — the machine never auto-assigns (§8).
      if (event.type !== 'RATE') return state;
      return { ...state, phase: 'Done', rating: event.rating, teacherNote: null };

    case 'RatingFailure':
      if (event.type !== 'RATE') return state;
      // The note field exists only on this branch.
      return { ...state, phase: 'Done', rating: event.rating, teacherNote: event.teacherNote ?? null };

    case 'Done':
      return state;

    default:
      return state;
  }
}

/** Advance feedback phases that have no user input of their own. */
export function autoAdvance(state: SessionState): SessionState {
  if (state.phase === 'CorrectFeedback') return { ...state, phase: 'RatingSuccess' };
  if (state.phase === 'Exhausted') return { ...state, phase: 'RatingFailure' };
  return state;
}
