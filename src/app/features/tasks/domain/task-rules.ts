import { isLocalDate, type LocalDate } from '../../../core/clock/local-date';
import { countsTowardFocus } from '../../../core/domain/focus-metrics';
import type {
  FocusSession,
  Task,
} from '../../../core/domain/workspace-records';

export const priorities = ['low', 'medium', 'high'] as const;
export const filters = ['all', 'pending', 'completed', 'overdue'] as const;
export const sorts = ['dueDate', 'priority', 'created', 'updated'] as const;
export type TaskFilter = (typeof filters)[number];
export type TaskSort = (typeof sorts)[number];
export type TaskDraft = Pick<
  Task,
  'title' | 'priority' | 'dueDate' | 'expectedSessions'
>;
type DraftFields = { [K in keyof TaskDraft]: string };
export type DraftField = keyof DraftFields;

const rank = { low: 0, medium: 1, high: 2 };

export function isOverdue(task: Task, today: LocalDate): boolean {
  return (
    task.status === 'pending' && task.dueDate !== null && task.dueDate < today
  );
}

const withPriority = (a: Task, b: Task) => rank[b.priority] - rank[a.priority];
const byUpdated = (a: Task, b: Task) => b.updatedAt.localeCompare(a.updatedAt);
const byDue = (a: Task, b: Task) => {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate.localeCompare(b.dueDate);
};

export function selectTasks(
  tasks: readonly Task[],
  today: LocalDate,
  filter: TaskFilter,
  sort: TaskSort,
): Task[] {
  const comparing = {
    dueDate: (a: Task, b: Task) => byDue(a, b) || withPriority(a, b),
    priority: (a: Task, b: Task) => withPriority(a, b) || byDue(a, b),
    created: (a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt),
    updated: byUpdated,
  }[sort];
  return tasks
    .filter(
      (task) =>
        task.deletedAt === null &&
        (filter === 'all' ||
          (filter === 'overdue'
            ? isOverdue(task, today)
            : task.status === filter)),
    )
    .sort(
      (a, b) => comparing(a, b) || byUpdated(a, b) || a.id.localeCompare(b.id),
    );
}

export function selectTodayTasks(
  tasks: readonly Task[],
  today: LocalDate,
): Task[] {
  const group = (task: Task) =>
    task.dueDate === null ? 2 : task.dueDate === today ? 1 : 0;
  return tasks
    .filter(
      (task) =>
        task.deletedAt === null &&
        task.status === 'pending' &&
        (task.dueDate === null || task.dueDate <= today),
    )
    .sort(
      (a, b) =>
        group(a) - group(b) ||
        withPriority(a, b) ||
        byUpdated(a, b) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}

export function selectDueTodayTotals(tasks: readonly Task[], today: LocalDate) {
  const due = tasks.filter(
    (task) => task.deletedAt === null && task.dueDate === today,
  );
  return {
    total: due.length,
    completed: due.filter((task) => task.status === 'completed').length,
  };
}

export function countTaskSessions(
  sessions: readonly FocusSession[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    if (session.taskId !== null && countsTowardFocus(session)) {
      counts.set(session.taskId, (counts.get(session.taskId) ?? 0) + 1);
    }
  }
  return counts;
}

export function validateTaskDraft(
  fields: DraftFields,
  malformedDate = false,
): { valid: true; draft: TaskDraft } | { valid: false; invalid: DraftField[] } {
  const title = fields.title.trim();
  const priority = priorities.find((choice) => choice === fields.priority);
  const dueDate = isLocalDate(fields.dueDate) ? fields.dueDate : null;
  const expected = fields.expectedSessions
    .trim()
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) & 15),
    );
  const expectedSessions =
    expected === '' ? null : /^\d+$/.test(expected) ? Number(expected) : NaN;
  const invalid: DraftField[] = [];

  if (!title) invalid.push('title');
  if (!priority) invalid.push('priority');
  if (malformedDate || (fields.dueDate !== '' && dueDate === null))
    invalid.push('dueDate');
  if (
    expectedSessions !== null &&
    (!Number.isSafeInteger(expectedSessions) || expectedSessions <= 0)
  )
    invalid.push('expectedSessions');

  if (invalid.length || !priority) return { valid: false, invalid };
  return { valid: true, draft: { title, priority, dueDate, expectedSessions } };
}
