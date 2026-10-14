import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { avatarUrl } from '../../core/util/image-url';

/** A user's round avatar, or the first letter of the name when there is no picture. */
@Component({
  selector: 'app-user-avatar',
  template: `
    @if (src(); as url) {
      <img [src]="url" alt="" loading="lazy" />
    } @else {
      <span aria-hidden="true">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      overflow: hidden;
      background: var(--surface-2);
      font-weight: 700;
      font-size: calc(var(--size) * 0.42);
      color: var(--text-2);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  host: { '[style.--size.px]': 'size()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatar {
  /** Avatar as the backend sends it (absolute URL, data URI or backend path). */
  readonly url = input<string | null | undefined>(null);
  readonly name = input<string | null | undefined>(null);
  readonly size = input(40);

  protected readonly src = computed(() => avatarUrl(this.url()));
  protected readonly initial = computed(() => (this.name()?.trim().charAt(0) || '?').toUpperCase());
}
