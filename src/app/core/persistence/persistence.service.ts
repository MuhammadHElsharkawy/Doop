import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  defaultPreferences,
  PreferencesService,
} from '../preferences/preferences.service';
import type { WorkspaceMetadata } from '../domain/workspace-records';
import type { IsoInstant } from '../clock/local-date';
import type { BackupV2 } from './backup';
import {
  WorkspaceDatabase,
  type StorageStatus,
} from '../database/workspace-database';
import { WorkspaceRepository } from './workspace.repository';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly preferences = inject(PreferencesService);
  private readonly state = signal<StorageStatus>('loading');
  private readonly database = new WorkspaceDatabase(
    undefined,
    (status) => this.state.set(status),
    () => this.preferences.legacyPreferences(),
  );
  private metadata?: WorkspaceMetadata;

  readonly status = this.state.asReadonly();
  private readonly replacement = signal(0);
  readonly replacementRevision = this.replacement.asReadonly();
  private readonly channel =
    typeof BroadcastChannel === 'undefined'
      ? undefined
      : new BroadcastChannel('doop-workspace-replacement');
  readonly repositories = new WorkspaceRepository(this.database);

  constructor() {
    if (this.channel)
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'replaced' || event.data === 'preferences')
          void this.refreshMetadata().catch(() => undefined);
      };
    inject(DestroyRef).onDestroy(() => {
      this.channel?.close();
      this.database.close();
    });
    this.preferences.connect(async (key, value) => {
      const expected = this.metadata?.generation;
      const current = this.metadata ?? (await this.refreshMetadata());
      const saved = await this.repositories.writePreferences(
        (preferences) => ({ ...preferences, [key]: value }),
        expected ?? current.generation,
      );
      this.observeMetadata(saved);
      if (saved.generation !== (expected ?? current.generation))
        throw new Error('Workspace was replaced');
      this.channel?.postMessage('preferences');
      return saved.preferences ?? defaultPreferences;
    });
    void this.refreshMetadata().catch(() => undefined);
  }

  async replaceWorkspace(backup: BackupV2 | null): Promise<void> {
    this.observeMetadata(await this.repositories.replaceWorkspace(backup));
    this.channel?.postMessage('replaced');
  }

  async exportBackup(at: IsoInstant): Promise<Blob> {
    await this.refreshMetadata();
    return this.repositories.exportBackup(at);
  }

  async refreshMetadata(): Promise<WorkspaceMetadata> {
    let current = await this.repositories.readMetadata();
    if (!current.preferences) {
      const legacy = this.preferences.legacyPreferences();
      if (legacy)
        current = await this.repositories.initializePreferences(legacy);
    }
    this.observeMetadata(current);
    return current;
  }

  observeMetadata(current: WorkspaceMetadata): void {
    const previous = this.metadata;
    if (previous && current.revision < previous.revision) return;
    this.metadata = current;
    const replaced = current.generation > (previous?.generation ?? 0);
    if (replaced) {
      this.database.resetOperationFailures();
      this.replacement.set(current.generation);
    }
    const value = current.preferences;
    const old = previous?.preferences;
    if (
      replaced ||
      (value &&
        (!old ||
          value.language !== old.language ||
          value.theme !== old.theme ||
          value.appearance !== old.appearance))
    )
      this.preferences.adopt(value ?? defaultPreferences, replaced);
  }

  async retry(): Promise<void> {
    try {
      await this.database.retry();
      await this.refreshMetadata();
    } catch {
      // The underlying storage operation reports its own error.
    }
  }
}
