import { describe, expect, it } from 'vitest';
import {
  initialSessionState,
  MAX_ATTEMPTS,
  sessionReducer,
  type SessionState,
} from './session-machine.js';

const wrong = (n: number): { type: 'ANSWER'; correct: boolean; value: unknown; at: string } => ({
  type: 'ANSWER',
  correct: false,
  value: n,
  at: new Date(2026, 0, 1, 9, n).toISOString(),
});

function run(events: Parameters<typeof sessionReducer>[1][]): SessionState {
  return events.reduce(sessionReducer, initialSessionState());
}

describe('sessionReducer', () => {
  it('walks the happy path to a manual success rating', () => {
    const s = run([
      { type: 'START' },
      { type: 'CHILD_AUDIO_FINISHED' },
      { type: 'ANSWER', correct: true, value: 'a', at: '2026-01-01T09:00:00.000Z' },
    ]);
    expect(s.phase).toBe('CorrectFeedback');
    const rated = sessionReducer({ ...s, phase: 'RatingSuccess' }, { type: 'RATE', rating: 'PRESENT' });
    expect(rated.phase).toBe('Done');
    expect(rated.rating).toBe('PRESENT');
  });

  it('exhausts after three wrong attempts and records every raw answer', () => {
    const s = run([
      { type: 'START' },
      { type: 'CHILD_AUDIO_FINISHED' },
      wrong(1),
      { type: 'CONTINUE_AFTER_WRONG' },
      wrong(2),
      { type: 'CONTINUE_AFTER_WRONG' },
      wrong(3),
    ]);
    expect(s.attempts).toBe(MAX_ATTEMPTS);
    expect(s.phase).toBe('Exhausted');
    expect(s.rawAnswers).toHaveLength(3);
  });

  it('accepts a note only on the failure branch', () => {
    const failure: SessionState = {
      phase: 'RatingFailure',
      hasDemo: false,
      attempts: 3,
      rawAnswers: [],
      rating: null,
      teacherNote: null,
    };
    const rated = sessionReducer(failure, { type: 'RATE', rating: 'ABSENT', teacherNote: 'distracted' });
    expect(rated.teacherNote).toBe('distracted');

    const success: SessionState = { ...failure, phase: 'RatingSuccess' };
    const ratedOk = sessionReducer(success, { type: 'RATE', rating: 'PRESENT', teacherNote: 'x' });
    expect(ratedOk.teacherNote).toBeNull();
  });

  it('routes through Demo before ChildInstruction when the subdomain has one', () => {
    const s = [{ type: 'START' as const }].reduce(sessionReducer, initialSessionState(true));
    expect(s.phase).toBe('Demo');
    const afterDemo = sessionReducer(s, { type: 'DEMO_DONE' });
    expect(afterDemo.phase).toBe('ChildInstruction');
  });

  it('skips Demo straight to ChildInstruction when the subdomain has none', () => {
    const s = [{ type: 'START' as const }].reduce(sessionReducer, initialSessionState(false));
    expect(s.phase).toBe('ChildInstruction');
  });

  it('never auto-assigns a rating', () => {
    const s = run([
      { type: 'START' },
      { type: 'CHILD_AUDIO_FINISHED' },
      { type: 'ANSWER', correct: true, value: 'a', at: '2026-01-01T09:00:00.000Z' },
    ]);
    expect(s.rating).toBeNull();
  });
});
