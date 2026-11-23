import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #panel [attr.aria-label]="heading()" (close)="restoreFocus()">
      <div class="dialog-header">
        <h2>{{ heading() }}</h2>
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="closeLabel()"
          [title]="closeLabel()"
          (click)="panel.close()"
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
  private readonly panel =
    viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  private trigger?: HTMLElement;

  open(trigger: HTMLElement): void {
    this.trigger = trigger;
    this.panel().nativeElement.showModal();
  }

  protected restoreFocus(): void {
    if (this.panel().nativeElement.open) return;
    this.trigger?.focus();
    this.trigger = undefined;
  }
}
