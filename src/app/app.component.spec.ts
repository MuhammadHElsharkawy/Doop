import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';

it('renders the requested route inside the main landmark', async () => {
  TestBed.configureTestingModule(appConfig);
  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();

  await TestBed.inject(Router).navigateByUrl('/focus');
  await fixture.whenStable();
  const host: HTMLElement = fixture.nativeElement;

  expect(host.querySelector('main h1')?.textContent?.trim()).toBe('Focus');
  expect(
    host.querySelector('a[aria-current="page"]')?.textContent?.trim(),
  ).toBe('Focus');
});
