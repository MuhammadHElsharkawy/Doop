import { expect, it } from 'vitest';
import { isLocalDate, toIsoInstant } from '../../../core/clock/local-date';
import type {
  FocusSession,
  Task,
} from '../../../core/domain/workspace-records';
import {
  countTaskSessions,
  isOverdue,
  selectTasks,
  selectTodayTasks,
  validateTaskDraft,
} from './task-rules';

function day(value: string) {
  if (!isLocalDate(value)) throw new Error('Invalid fixture date');
  return value;
}
const today = day('2026-06-02');
const now = toIsoInstant(new Date('2026-06-02T12:00:00Z'));
const later = toIsoInstant(new Date('2026-06-03T01:00:00Z'));
const task = (id: string, values: Partial<Task> = {}): Task => ({
  id,
  title: id,
  priority: 'medium',
  dueDate: null,
  expectedSessions: null,
  status: 'pending',
  createdAt: now,
  updatedAt: now,
  completedAt: null,
  deletedAt: null,
  ...values,
});
const yesterday = day('2026-06-01');

it('filters and sorts tasks with due dates, priorities, and timestamps', () => {
  const records = [
    task('undated', { priority: 'high', createdAt: later }),
    task('yesterday low', { priority: 'low', dueDate: yesterday }),
    task('yesterday high', { priority: 'high', dueDate: yesterday }),
    task('today', { dueDate: today, updatedAt: later }),
    task('done', { dueDate: today, status: 'completed', completedAt: now }),
    task('deleted', { deletedAt: now }),
  ];
  const ids = (choices: Task[]) => choices.map(({ id }) => id);
  expect(ids(selectTasks(records, today, 'all', 'dueDate'))).toEqual([
    'yesterday high',
    'yesterday low',
    'today',
    'done',
    'undated',
  ]);
  expect(ids(selectTasks(records, today, 'overdue', 'dueDate'))).toEqual([
    'yesterday high',
    'yesterday low',
  ]);
  expect(ids(selectTasks(records, today, 'completed', 'dueDate'))).toEqual([
    'done',
  ]);
  expect(
    selectTasks(records, today, 'pending', 'priority').map(({ id }) => id),
  ).toEqual(['yesterday high', 'undated', 'today', 'yesterday low']);
  expect(selectTasks(records, today, 'all', 'created')[0]?.id).toBe('undated');
  expect(selectTasks(records, today, 'all', 'updated')[0]?.id).toBe('today');
  expect(isOverdue(task('due', { dueDate: today }), today)).toBe(false);
  expect(isOverdue(task('due', { dueDate: today }), day('2026-06-03'))).toBe(
    true,
  );
});

it('keeps at most five due, overdue, or undated pending tasks on Overview in priority groups', () => {
  const records = [
    task('overdue low', { dueDate: yesterday, priority: 'low' }),
    task('today high', { dueDate: today, priority: 'high' }),
    task('overdue high', { dueDate: yesterday, priority: 'high' }),
    task('undated high', { priority: 'high' }),
    task('undated low', { priority: 'low' }),
    task('undated medium'),
    task('future', { dueDate: day('2026-06-03'), priority: 'high' }),
    task('completed', {
      status: 'completed',
      completedAt: now,
      dueDate: yesterday,
    }),
  ];
  expect(selectTodayTasks(records, today).map(({ id }) => id)).toEqual([
    'overdue high',
    'overdue low',
    'today high',
    'undated high',
    'undated medium',
  ]);
});

it('validates shared TaskForm fields and normalizes Arabic input', () => {
  const input = {
    title: '  Read  ',
    priority: 'medium',
    dueDate: today,
    expectedSessions: '٢',
  };
  expect(validateTaskDraft(input)).toEqual({
    valid: true,
    draft: {
      title: 'Read',
      priority: 'medium',
      dueDate: today,
      expectedSessions: 2,
    },
  });
  expect(
    validateTaskDraft({
      title: ' ',
      priority: '',
      dueDate: '2026-02-30',
      expectedSessions: '1.5',
    }),
  ).toEqual({
    valid: false,
    invalid: ['title', 'priority', 'dueDate', 'expectedSessions'],
  });
  for (const expectedSessions of ['0', '-1', '1e3', '9007199254740992']) {
    expect(validateTaskDraft({ ...input, expectedSessions })).toEqual({
      valid: false,
      invalid: ['expectedSessions'],
    });
  }
  expect(
    validateTaskDraft({ ...input, expectedSessions: '', dueDate: '' }),
  ).toMatchObject({
    valid: true,
    draft: { dueDate: null, expectedSessions: null },
  });
  expect(validateTaskDraft({ ...input, dueDate: '' }, true)).toEqual({
    valid: false,
    invalid: ['dueDate'],
  });
});

it('counts only completed linked focus records', () => {
  const session: FocusSession = {
    id: 'timer',
    taskId: 'read',
    taskTitleSnapshot: 'Read',
    type: 'timer',
    status: 'completed',
    plannedDurationSeconds: 1500,
    actualDurationSeconds: 1500,
    startedAt: toIsoInstant(new Date('2026-06-02T11:35:00Z')),
    endedAt: now,
    completionLocalDate: today,
    completionTimezoneOffsetMinutes: 0,
  };
  expect(
    countTaskSessions([
      session,
      {
        ...session,
        id: 'partial',
        status: 'partial',
        actualDurationSeconds: 5,
      },
      {
        ...session,
        id: 'watch',
        type: 'stopwatch',
        plannedDurationSeconds: null,
      },
      { ...session, id: 'unlinked', taskId: null, taskTitleSnapshot: null },
    ]).get('read'),
  ).toBe(2);
});
