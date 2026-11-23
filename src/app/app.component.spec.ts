import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { AppComponent } from './app.component';

it('renders the Doop heading in the main landmark', () => {
  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();

  const host: HTMLElement = fixture.nativeElement;
  expect(host.querySelector('main > h1')?.textContent?.trim()).toBe('Doop');
});
