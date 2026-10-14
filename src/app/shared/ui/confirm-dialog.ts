import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Destructive actions get a red confirm button. */
  destructive?: boolean;
}

/** Yes/no confirmation dialog (CDK Dialog: focus trap, Esc closes = cancel). */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="dialog" role="alertdialog" [attr.aria-label]="data.title">
      <h2 class="t-title-lg">{{ data.title }}</h2>
      <p class="t-body-lg t-secondary">{{ data.message }}</p>
      <div class="buttons">
        <button class="btn" type="button" (click)="ref.close(false)">{{ data.cancelLabel }}</button>
        <button
          class="btn primary"
          [class.danger]="data.destructive"
          type="button"
          (click)="ref.close(true)"
          cdkFocusInitial
        >
          {{ data.confirmLabel }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--space-3);
      width: min(440px, 100vw - 2 * var(--space-4));
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background: var(--surface-1);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-1);
    }
    .danger {
      background: var(--error);
      border-color: var(--error);
      &:hover {
        background: color-mix(in srgb, var(--error) 85%, black);
      }
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(Dialog);

  /** Resolves to true only when the user confirms. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: options,
      backdropClass: 'dialog-backdrop',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
