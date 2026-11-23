import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-xl px-6 py-24 sm:py-32">
      <h1 class="baseline-title text-4xl sm:text-5xl">Doop</h1>
      <p class="mt-4">This build verifies the Doop web app setup.</p>
    </main>
  `,
})
export class AppComponent {}
