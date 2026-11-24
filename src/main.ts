import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

void bootstrapApplication(AppComponent, appConfig).catch(() => {
  const fallback = document.querySelector<HTMLElement>('#startup-error');
  if (!fallback) return;

  document.querySelector('app-root')?.remove();
  fallback.hidden = false;
  fallback.focus();
});
