import {
  computed,
  DOCUMENT,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { LocalCalendarService } from '../../../core/clock/local-calendar.service';
import { toIsoInstant } from '../../../core/clock/local-date';
import { createRecordId } from '../../../core/domain/record-id';
import type { Task } from '../../../core/domain/workspace-records';
import { FocusHistoryService } from '../../../core/persistence/focus-history.service';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import { taskViewKey as viewKey } from '../../../core/preferences/preferences.service';
import {
  countTaskSessions,
  filters,
  selectTasks,
  selectDueTodayTotals,
  selectTodayTasks,
  sorts,
  type TaskDraft,
  type TaskFilter,
  type TaskSort,
} from '../domain/task-rules';

type View = { filter: TaskFilter; sort: TaskSort };

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly persistence = inject(PersistenceService);
  private readonly repository = this.persistence.repositories.tasks;
  private readonly document = inject(DOCUMENT);
  private readonly records = signal<Task[]>([]);
  private readonly history = inject(FocusHistoryService);
  private readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly running = signal(false);
  private readonly viewError = signal(false);
  private readonly viewState = signal(this.readView());
  private loadId = 0;

  readonly status = this.state.asReadonly();
  readonly busy = this.running.asReadonly();
  readonly today = inject(LocalCalendarService).today;
  readonly view = this.viewState.asReadonly();
  readonly viewStorageError = this.viewError.asReadonly();
  readonly visible = computed(() =>
    selectTasks(
      this.records(),
      this.today(),
      this.view().filter,
      this.view().sort,
    ),
  );
  readonly overview = computed(() =>
    selectTodayTasks(this.records(), this.today()),
  );
  readonly available = this.records.asReadonly();
  readonly dueToday = computed(() =>
    this.status() === 'ready'
      ? selectDueTodayTotals(this.records(), this.today())
      : null,
  );
  readonly counts = computed(() => {
    const total = this.records().length;
    const completed = this.records().filter(
      (task) => task.status === 'completed',
    ).length;
    return { total, completed, pending: total - completed };
  });
  readonly sessionCounts = computed(() => {
    const sessions = this.history.sessions();
    return sessions === null ? null : countTaskSessions(sessions);
  });

  constructor() {
    effect(() => {
      if (!this.persistence.replacementRevision()) return;
      untracked(() => {
        this.viewState.set(this.readView());
        this.state.set('loading');
        void this.load();
      });
    });
    effect(() => {
      if (this.persistence.status() === 'ready' && this.state() === 'error') {
        untracked(() => void this.load());
      }
    });
    const onVisible = () => {
      if (this.document.visibilityState !== 'visible') return;
      if (this.state() === 'ready' && !this.busy()) void this.load();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisible);
    });
    void this.load();
  }

  async retry(): Promise<void> {
    if (this.busy()) return;
    await this.persistence.retry();
    await Promise.all([this.load(), this.history.refresh()]);
  }

  private async load(): Promise<void> {
    const request = ++this.loadId;
    if (this.state() !== 'ready') this.state.set('loading');
    try {
      const tasks = await this.repository.list();
      if (request !== this.loadId) return;
      this.records.set(tasks);
      this.state.set('ready');
    } catch {
      if (request === this.loadId) this.state.set('error');
    }
  }

  setFilter(value: string): void {
    const filter = filters.find((choice) => choice === value);
    if (filter) this.saveView({ ...this.view(), filter });
  }

  setSort(value: string): void {
    const sort = sorts.find((choice) => choice === value);
    if (sort) this.saveView({ ...this.view(), sort });
  }

  private saveView(view: View): void {
    this.viewState.set(view);
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(viewKey, JSON.stringify(view));
      this.viewError.set(false);
    } catch {
      this.viewError.set(true);
    }
  }

  private readView(): View {
    const defaults: View = { filter: 'all', sort: 'dueDate' };
    try {
      const raw = this.document.defaultView?.localStorage.getItem(viewKey);
      if (!raw) return defaults;
      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null) return defaults;
      return {
        filter:
          'filter' in value
            ? (filters.find((choice) => choice === value.filter) ??
              defaults.filter)
            : defaults.filter,
        sort:
          'sort' in value
            ? (sorts.find((choice) => choice === value.sort) ?? defaults.sort)
            : defaults.sort,
      };
    } catch {
      this.viewError.set(true);
      return defaults;
    }
  }

  async create(draft: TaskDraft, id: string): Promise<void> {
    await this.mutate(async () => {
      const now = toIsoInstant(new Date());
      const task: Task = {
        ...draft,
        id,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        deletedAt: null,
      };
      await this.repository.add(task);
      this.records.update((current) => [...current, task]);
    });
  }

  async edit(id: string, draft: TaskDraft): Promise<void> {
    await this.mutate(async () => {
      const saved = await this.repository.update(
        id,
        (current) => ({
          ...current,
          ...draft,
          updatedAt: toIsoInstant(new Date()),
        }),
        'edit',
      );
      if (!saved) throw new Error('Task no longer exists');
      this.replaceRow(saved);
    });
  }

  changeCompletion(
    id: string,
    complete: boolean,
    expected?: Task,
  ): Promise<Task | undefined> {
    return this.mutate(async () => {
      let changed = false;
      const saved = await this.repository.update(
        id,
        (current) => {
          if (current.status === (complete ? 'completed' : 'pending'))
            return current;
          if (
            expected &&
            (current.updatedAt !== expected.updatedAt ||
              current.completedAt !== expected.completedAt)
          )
            return undefined;
          const now = toIsoInstant(new Date());
          changed = true;
          return {
            ...current,
            status: complete ? 'completed' : 'pending',
            completedAt: complete ? now : null,
            updatedAt: now,
          };
        },
        expected ? 'undo' : complete ? 'complete' : 'reopen',
      );
      if (saved) this.replaceRow(saved);
      if (!saved && !expected) throw new Error('Task no longer exists');
      return changed ? saved : undefined;
    });
  }

  async remove(id: string): Promise<void> {
    await this.mutate(async () => {
      await this.repository.softDelete(id, toIsoInstant(new Date()));
      this.records.update((current) =>
        current.filter((task) => task.id !== id),
      );
    });
  }

  private replaceRow(saved: Task): void {
    this.records.update((current) =>
      current.some((task) => task.id === saved.id)
        ? current.map((task) => (task.id === saved.id ? saved : task))
        : [...current, saved],
    );
  }

  private async mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy() || this.state() !== 'ready')
      throw new Error('Task storage is not ready');
    ++this.loadId;
    this.running.set(true);
    try {
      return await operation();
    } finally {
      this.running.set(false);
    }
  }

  newId(): string {
    return createRecordId();
  }
}
