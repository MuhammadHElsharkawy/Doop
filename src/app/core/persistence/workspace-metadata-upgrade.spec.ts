import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { expect, it, vi } from 'vitest';
import {
  WorkspaceDatabase,
  type StorageStatus,
} from '../database/workspace-database';
import { createRecordId } from '../domain/record-id';
import { WorkspaceRepository } from './workspace.repository';

const unversioned = {
  id: 'workspace',
  generation: 7,
  preferences: { theme: 'indigo', appearance: 'dark', language: 'ar' },
};

async function seedV4(row: object) {
  const name = 'metadata-upgrade-' + createRecordId();
  const v4 = await openDB(name, 4, {
    upgrade(database) {
      for (const store of [
        'metadata',
        'activeSession',
        'cycle',
        'settings',
        'tasks',
        'habits',
        'schedules',
        'completions',
        'sessions',
      ])
        database.createObjectStore(store, { keyPath: 'id' });
    },
  });
  await v4.add('metadata', row);
  v4.close();
  return name;
}

it('serializes concurrent repairs and preserves a newer metadata revision when reopening', async () => {
  const name = await seedV4(unversioned);
  const first = new WorkspaceDatabase(name);
  const second = new WorkspaceDatabase(name);
  const firstRepo = new WorkspaceRepository(first);
  const secondRepo = new WorkspaceRepository(second);
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  try {
    const metadata = { ...unversioned, revision: 0 };
    expect(
      await Promise.all([firstRepo.readMetadata(), secondRepo.readMetadata()]),
    ).toEqual([metadata, metadata]);
    expect(put).toHaveBeenCalledExactlyOnceWith(metadata);

    const beforeReplacement = await secondRepo.focusSnapshot();
    const saved = await firstRepo.writePreferences(
      (previous) => ({
        ...previous,
        theme: 'rose',
      }),
      unversioned.generation,
    );
    expect(saved).toEqual({
      ...metadata,
      revision: 1,
      preferences: { ...metadata.preferences, theme: 'rose' },
    });
    first.close();
    expect(await firstRepo.readMetadata()).toEqual(saved);
    expect(put).toHaveBeenCalledTimes(2);

    const replaced = await firstRepo.replaceWorkspace(null);
    expect(replaced).toMatchObject({ revision: 2, generation: 8 });
    await expect(
      secondRepo.updateFocus(
        beforeReplacement,
        () => {
          throw new Error('Stale command reached the transition');
        },
        'start',
      ),
    ).resolves.toMatchObject({ result: 'conflict', metadata: replaced });
    expect((await secondRepo.focusSnapshot()).active).toBeUndefined();
  } finally {
    first.close();
    second.close();
    put.mockRestore();
  }
});

it('opens valid v4 metadata without writing it', async () => {
  const existing = { ...unversioned, revision: 23 };
  const database = new WorkspaceDatabase(await seedV4(existing));
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  try {
    expect(await new WorkspaceRepository(database).readMetadata()).toEqual(
      existing,
    );
    expect((await database.open()).version).toBe(5);
    expect(put).not.toHaveBeenCalled();
  } finally {
    database.close();
    put.mockRestore();
  }
});

it.each([
  ['missing generation', { id: 'workspace', preferences: null }],
  ['missing preferences', { id: 'workspace', generation: 7 }],
  [
    'malformed preferences',
    { ...unversioned, preferences: { theme: 'unknown' } },
  ],
  ['additional field', { ...unversioned, unexpected: true }],
  ['undefined revision', { ...unversioned, revision: undefined }],
  ['malformed revision', { ...unversioned, revision: -1 }],
])(
  'keeps metadata with %s unchanged and rejects it',
  async (_description, row) => {
    const name = await seedV4(row);
    const statuses: StorageStatus[] = [];
    const database = new WorkspaceDatabase(name, (status) =>
      statuses.push(status),
    );
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    try {
      await expect(
        new WorkspaceRepository(database).readMetadata(),
      ).rejects.toThrow('Invalid metadata record');
      expect(statuses.at(-1)).toBe('invalid-record');
      expect(
        await (await database.open()).get('metadata', 'workspace'),
      ).toEqual(row);
      expect(put).not.toHaveBeenCalled();
    } finally {
      database.close();
      put.mockRestore();
    }
  },
);

it('leaves v4 and its original row intact when the metadata repair write fails', async () => {
  const name = await seedV4(unversioned);
  const database = new WorkspaceDatabase(name);
  const put = vi
    .spyOn(IDBObjectStore.prototype, 'put')
    .mockImplementationOnce(() => {
      throw new DOMException(
        'Metadata repair cannot write',
        'QuotaExceededError',
      );
    });
  try {
    await expect(database.open()).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
  } finally {
    put.mockRestore();
  }

  const original = await openDB(name, 4);
  try {
    expect(original.version).toBe(4);
    expect(await original.get('metadata', 'workspace')).toEqual(unversioned);
  } finally {
    original.close();
  }

  try {
    await database.retry();
    expect(await new WorkspaceRepository(database).readMetadata()).toEqual({
      ...unversioned,
      revision: 0,
    });
  } finally {
    database.close();
  }
});
