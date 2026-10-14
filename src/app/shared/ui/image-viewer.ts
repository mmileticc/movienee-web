import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

interface ImageViewerData {
  images: string[];
  index: number;
  alt: string;
}

/**
 * Full-screen image viewer (FullScreenImageDialog.kt): the whole picture, arrows / arrow keys to move
 * through a gallery, Esc or a click outside the image to close. Built on the CDK Dialog (focus trap,
 * scroll lock, Esc and backdrop handling).
 */
@Component({
  selector: 'app-image-viewer',
  imports: [TranslocoPipe],
  template: `
    <img class="image" [src]="data.images[index()]" [alt]="data.alt" />
    <button
      class="icon-btn close"
      type="button"
      (click)="close()"
      [attr.aria-label]="'action_close' | transloco"
    >
      <span class="icon" aria-hidden="true">close</span>
    </button>
    @if (data.images.length > 1) {
      <button class="icon-btn nav prev" type="button" (click)="move(-1)" aria-label="←">
        <span class="icon" aria-hidden="true">chevron_left</span>
      </button>
      <button class="icon-btn nav next" type="button" (click)="move(1)" aria-label="→">
        <span class="icon" aria-hidden="true">chevron_right</span>
      </button>
      <span class="counter">{{ index() + 1 }} / {{ data.images.length }}</span>
    }
  `,
  // Arrow keys move through the gallery (the dialog container holds the focus, so keys reach the host).
  host: {
    '(keydown.arrowLeft)': 'move(-1)',
    '(keydown.arrowRight)': 'move(1)',
  },
  styles: `
    :host {
      display: block;
    }
    .image {
      display: block;
      max-width: 92vw;
      max-height: 86dvh;
      object-fit: contain;
      border-radius: var(--radius-sm);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    }
    .icon-btn {
      position: fixed;
      color: #fff;
      background: rgba(0, 0, 0, 0.5);
      &:hover {
        background: rgba(0, 0, 0, 0.75);
      }
    }
    .close {
      top: var(--space-4);
      right: var(--space-4);
    }
    .nav {
      top: 50%;
      translate: 0 -50%;
    }
    .prev {
      left: var(--space-4);
    }
    .next {
      right: var(--space-4);
    }
    .counter {
      position: fixed;
      left: 50%;
      bottom: var(--space-4);
      translate: -50% 0;
      color: #fff;
      font-size: 0.875rem;
      opacity: 0.8;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageViewer {
  protected readonly data = inject<ImageViewerData>(DIALOG_DATA);
  private readonly ref = inject(DialogRef);
  protected readonly index = signal(this.data.index);

  protected move(step: number): void {
    const count = this.data.images.length;
    this.index.set((this.index() + step + count) % count);
  }

  protected close(): void {
    this.ref.close();
  }
}

/** Opens the full-screen image viewer. */
@Injectable({ providedIn: 'root' })
export class ImageViewerService {
  private readonly dialog = inject(Dialog);

  open(images: string[], index: number, alt: string): void {
    this.dialog.open(ImageViewer, {
      data: { images, index, alt } satisfies ImageViewerData,
      panelClass: 'image-viewer-panel',
      backdropClass: 'image-viewer-backdrop',
      maxWidth: '100vw',
    });
  }
}
