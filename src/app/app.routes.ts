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
  ...destinations.map((section) => ({
    path: section,
    data: { section },
    loadComponent: () =>
      import('./shared/layout/destination-page.component').then(
        (module) => module.DestinationPageComponent,
      ),
  })),
  { path: '**', redirectTo: 'overview' },
];
