import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #panel
      [attr.aria-label]="heading()"
      [class.full-height-sheet]="fullHeightSheet()"
      (close)="restoreFocus()"
      (cancel)="onCancel($event)"
    >
      <div class="dialog-header">
        <h2>{{ heading() }}</h2>
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="closeLabel()"
          [title]="closeLabel()"
          [disabled]="busy()"
          (click)="close()"
        >
          <app-icon name="close" />
        </button>
      </div>
      <ng-content />
    </dialog>
  `,
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  readonly heading = input.required<string>();
  readonly closeLabel = input.required<string>();
  readonly busy = input(false);
  readonly fullHeightSheet = input(false);
  readonly closed = output<void>();
  private readonly panel =
    viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  private trigger?: HTMLElement;
  private fallback?: HTMLElement;
  private readonly injector = inject(Injector);

  open(trigger: HTMLElement, fallback?: HTMLElement): void {
    this.trigger = trigger;
    this.fallback = fallback;
    this.panel().nativeElement.showModal();
  }

  close(): void {
    this.panel().nativeElement.close();
  }

  protected onCancel(event: Event): void {
    if (this.busy()) event.preventDefault();
  }

  protected restoreFocus(): void {
    if (this.panel().nativeElement.open) return;
    const trigger = this.trigger;
    const fallback = this.fallback ?? trigger?.closest<HTMLElement>('main');
    this.trigger = undefined;
    this.fallback = undefined;
    this.closed.emit();
    afterNextRender(
      () => {
        if (this.panel().nativeElement.open) return;
        const target =
          trigger?.isConnected && !trigger.matches(':disabled')
            ? trigger
            : fallback;
        target?.focus();
      },
      { injector: this.injector },
    );
  }
}
