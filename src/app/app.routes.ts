import { Routes } from '@angular/router';

export const destinations = [
  'overview',
  'tasks',
  'habits',
  'focus',
  'progress',
] as const;
export type Destination = (typeof destinations)[number];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    loadComponent: () =>
      import('./features/overview/overview-page.component').then(
        (module) => module.OverviewPageComponent,
      ),
  },
  {
    path: 'tasks',
    loadComponent: () =>
      import('./features/tasks/pages/tasks-page.component').then(
        (module) => module.TasksPageComponent,
      ),
  },
  {
    path: 'habits',
    loadComponent: () =>
      import('./features/habits/pages/habits-page.component').then(
        (module) => module.HabitsPageComponent,
      ),
  },
  {
    path: 'focus',
    loadComponent: () =>
      import('./features/focus/pages/focus-page.component').then(
        (module) => module.FocusPageComponent,
      ),
  },
  ...destinations
    .filter((section) => section === 'progress')
    .map((section) => ({
      path: section,
      data: { section },
      loadComponent: () =>
        import('./shared/layout/destination-page.component').then(
          (module) => module.DestinationPageComponent,
        ),
    })),
  { path: '**', redirectTo: 'overview' },
];
