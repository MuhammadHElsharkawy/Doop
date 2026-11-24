import { Routes } from '@angular/router';

export const destinations = [
  'overview',
  'tasks',
  'habits',
  'focus',
  'progress',
] as const;

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
  {
    path: 'progress',
    loadComponent: () =>
      import('./features/progress/pages/progress-page.component').then(
        (module) => module.ProgressPageComponent,
      ),
  },
  { path: '**', redirectTo: 'overview' },
];
