import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  WorkspaceDatabase,
  type StorageStatus,
} from '../database/workspace-database';
import { WorkspaceRepository } from './workspace.repository';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly state = signal<StorageStatus>('loading');
  private readonly database = new WorkspaceDatabase(undefined, (status) =>
    this.state.set(status),
  );

  readonly status = this.state.asReadonly();
  readonly repositories = new WorkspaceRepository(this.database);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.database.close());
    void this.database.open().catch(() => undefined);
  }

  retry(): void {
    void this.database.retry().catch(() => undefined);
  }
}
