import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  toIsoInstant,
  toLocalDate,
} from '../clock/local-date';
import { WorkspaceDatabase } from '../database/workspace-database';
import { createRecordId } from '../domain/record-id';
import type { Habit, HabitSchedule } from '../domain/workspace-records';
import { WorkspaceRepository } from './workspace.repository';

const date = new Date(2024, 1, 29, 12);
const day = toLocalDate(date);
const yesterday = addCalendarDays(day, -1);
const tomorrow = addCalendarDays(day, 1);
const now = toIsoInstant(date);
const later = toIsoInstant(new Date(date.getTime() + 60_000));
const habit: Habit = {
  id: 'habit',
  name: 'Original name',
  description: null,
  startDate: day,
  status: 'active',
  archivedAt: null,
  archivePeriods: [],
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  deletedLocalDate: null,
};
const schedule: HabitSchedule = {
  id: 'schedule',
  habitId: habit.id,
  weekdays: [4],
  effectiveFrom: day,
  effectiveTo: null,
  createdAt: now,
};

describe('habit workflow transactions', () => {
  let db: WorkspaceDatabase;
  let repository: WorkspaceRepository;

  beforeEach(() => {
    db = new WorkspaceDatabase(createRecordId());
    repository = new WorkspaceRepository(db);
  });
  afterEach(() => db.close());

  it('rolls back creation and a schedule edit when a schedule ID is already taken', async () => {
    await repository.habits.createWithSchedule(habit, schedule);
    await expect(
      repository.habits.createWithSchedule(
        { ...habit, id: 'second' },
        { ...schedule, habitId: 'second' },
      ),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    await expect(repository.habits.get('second')).resolves.toBeUndefined();
    await expect(
      repository.habits.editWithSchedule(
        habit,
        { name: 'Uncommitted', description: null, startDate: day },
        [5],
        'schedule',
        tomorrow,
        later,
      ),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await repository.schedules.get('schedule')).toEqual(schedule);
    expect(await repository.habits.get(habit.id)).toEqual(habit);
  });

  it('inserts one scheduled occurrence, rejects unscheduled dates and checks the occurrence identity on undo', async () => {
    await repository.habits.createWithSchedule(habit, schedule);
    await expect(
      repository.completions.setOccurrence(habit.id, tomorrow, {
        complete: true,
        id: 'invalid',
        now,
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    await Promise.all([
      repository.completions.setOccurrence(habit.id, day, {
        complete: true,
        id: 'first',
        now,
      }),
      repository.completions.setOccurrence(habit.id, day, {
        complete: true,
        id: 'second',
        now,
      }),
    ]);
    expect(await repository.completions.list()).toHaveLength(1);
    await expect(
      repository.completions.setOccurrence(habit.id, day, {
        complete: false,
        id: 'stale',
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    await repository.completions.setOccurrence(habit.id, day, {
      complete: false,
      id: 'first',
    });
    expect(await repository.completions.list()).toEqual([]);
  });

  it('versions an effective schedule and keeps the completion snapshot through rename, archive, restore and deletion', async () => {
    await repository.habits.createWithSchedule(habit, schedule);
    await repository.completions.setOccurrence(habit.id, day, {
      complete: true,
      id: 'done',
      now,
    });
    await repository.habits.editWithSchedule(
      habit,
      { name: 'New name', description: null, startDate: day },
      [5],
      'next',
      tomorrow,
      later,
    );
    expect(await repository.schedules.get(schedule.id)).toMatchObject({
      weekdays: [4],
      effectiveTo: tomorrow,
    });
    expect(await repository.schedules.get('next')).toMatchObject({
      weekdays: [5],
      effectiveFrom: tomorrow,
      effectiveTo: null,
    });
    await repository.habits.setArchived(habit.id, true, tomorrow, later);
    await expect(
      repository.completions.setOccurrence(habit.id, tomorrow, {
        complete: true,
        id: 'invalid',
        now,
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    const resumed = addCalendarDays(tomorrow, 2);
    await repository.habits.setArchived(habit.id, false, resumed, later);
    await repository.habits.softDelete(
      habit.id,
      later,
      addCalendarDays(resumed, 1),
    );
    expect(await repository.habits.list()).toEqual([]);
    const history = await repository.habits.readHistory();
    expect(history.habits[0]).toMatchObject({
      archivePeriods: [{ from: tomorrow, until: resumed }],
      deletedLocalDate: addCalendarDays(resumed, 1),
    });
    expect(history.completions[0]).toMatchObject({
      habitNameSnapshot: 'Original name',
      scheduledDate: day,
    });
  });

  it('applies edits today while preserving prior eligibility and today’s completion across repeated edits and reopen', async () => {
    const existing = { ...habit, startDate: yesterday };
    const details = {
      name: existing.name,
      description: null,
      startDate: yesterday,
    };
    const first = {
      ...schedule,
      effectiveFrom: yesterday,
      weekdays: [3, 4],
    } satisfies HabitSchedule;
    await repository.habits.createWithSchedule(existing, first);
    await repository.completions.setOccurrence(habit.id, day, {
      complete: true,
      id: 'today-done',
      now,
    });
    const completion = await repository.completions.getOccurrence(
      habit.id,
      day,
    );

    await repository.habits.editWithSchedule(
      existing,
      details,
      [5],
      'today',
      day,
      later,
    );
    expect(await repository.schedules.get(first.id)).toEqual({
      ...first,
      effectiveTo: day,
    });
    expect(await repository.schedules.get('today')).toMatchObject({
      weekdays: [5],
      effectiveFrom: day,
      effectiveTo: null,
    });
    await expect(
      repository.completions.setOccurrence(habit.id, day, {
        complete: true,
        id: 'unscheduled',
        now,
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await repository.completions.getOccurrence(habit.id, day)).toEqual(
      completion,
    );

    await repository.habits.editWithSchedule(
      { ...existing, updatedAt: later },
      details,
      [4, 5],
      'unused',
      day,
      later,
    );
    db.close();
    expect(await repository.schedules.list()).toEqual([
      { ...first, effectiveTo: day },
      {
        ...first,
        id: 'today',
        weekdays: [4, 5],
        effectiveFrom: day,
        createdAt: later,
      },
    ]);
    await repository.completions.setOccurrence(habit.id, day, {
      complete: true,
      id: 'duplicate',
      now,
    });
    expect(await repository.completions.list()).toEqual([completion]);
  });

  it('supersedes a pending legacy schedule without touching dates before today', async () => {
    const existing = { ...habit, startDate: yesterday };
    const details = {
      name: existing.name,
      description: null,
      startDate: yesterday,
    };
    const first = { ...schedule, effectiveFrom: yesterday };
    await repository.habits.createWithSchedule(existing, first);
    await repository.schedules.replace({
      ...schedule,
      id: 'pending',
      effectiveFrom: tomorrow,
      weekdays: [5],
    });
    await repository.habits.editWithSchedule(
      existing,
      details,
      [4, 5],
      'new',
      day,
      later,
    );
    expect(await repository.schedules.get(first.id)).toEqual({
      ...first,
      effectiveTo: day,
    });
    expect(await repository.schedules.get('pending')).toMatchObject({
      effectiveFrom: day,
      effectiveTo: null,
      weekdays: [4, 5],
    });
    expect(await repository.schedules.list()).toHaveLength(2);
  });

  it('changes a future start before it takes effect and updates a pending schedule without adding a duplicate interval', async () => {
    const future = { ...habit, startDate: tomorrow };
    await repository.habits.createWithSchedule(future, {
      ...schedule,
      effectiveFrom: tomorrow,
    });
    await repository.habits.editWithSchedule(
      future,
      { name: future.name, description: null, startDate: day },
      [4, 5],
      'ignored',
      day,
      later,
    );
    expect(await repository.schedules.list()).toEqual([
      { ...schedule, weekdays: [4, 5], createdAt: later },
    ]);
    await expect(
      repository.habits.editWithSchedule(
        future,
        { name: future.name, description: null, startDate: tomorrow },
        [5],
        'stale',
        day,
        now,
      ),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
  });
});
