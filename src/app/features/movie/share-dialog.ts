import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SocialApi } from '../../core/api/social-api';
import { FriendInfo } from '../../core/models/social';
import { UserAvatar } from '../../shared/ui/user-avatar';

/** Same limit as SHARE_NOTE_MAX_LENGTH on the backend. */
const NOTE_MAX_LENGTH = 200;

interface ShareDialogData {
  tmdbId: number;
  title: string;
}

/**
 * "Send to a friend" (ShareMovieDialog.kt): pick a friend and an optional message; the movie arrives
 * as a push notification and in the friend's Notifications. Closes with true when the movie was sent.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [TranslocoPipe, UserAvatar],
  template: `
    <form class="dialog" (submit)="send($event)" [attr.aria-label]="data.title">
      <h2 class="t-title-lg">{{ 'share_friend_dialog_title' | transloco: { p1: data.title } }}</h2>

      @if (friends() === null) {
        <p class="t-body t-secondary">…</p>
      } @else if (friends()!.length === 0) {
        <p class="t-body t-secondary">{{ 'share_friend_no_friends' | transloco }}</p>
      } @else {
        <ul class="friends" role="radiogroup" [attr.aria-label]="'share_menu_friend' | transloco">
          @for (friend of friends(); track friend.friend_id) {
            <li>
              <label class="friend" [class.selected]="selected() === friend.friend_id">
                <input
                  type="radio"
                  name="friend"
                  class="sr-only"
                  [value]="friend.friend_id"
                  [checked]="selected() === friend.friend_id"
                  (change)="selected.set(friend.friend_id)"
                />
                <app-user-avatar [url]="friend.avatar" [name]="friend.username" [size]="36" />
                <span class="t-title">{{ friend.username }}</span>
              </label>
            </li>
          }
        </ul>
        <label class="note">
          <span class="t-label">{{ 'share_friend_note_label' | transloco }}</span>
          <textarea
            rows="2"
            [maxLength]="noteMax"
            [value]="note()"
            (input)="note.set($any($event.target).value)"
          ></textarea>
          <span class="t-small t-muted counter">{{ note().length }}/{{ noteMax }}</span>
        </label>
      }

      @if (failed()) {
        <p class="error" role="alert">{{ 'share_friend_failed' | transloco }}</p>
      }

      <div class="buttons">
        <button class="btn" type="button" (click)="ref.close(false)">
          {{ 'action_close' | transloco }}
        </button>
        <button class="btn primary" type="submit" [disabled]="!selected() || sending()">
          {{ 'share_friend_send' | transloco }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--space-4);
      width: min(460px, 100vw - 2 * var(--space-4));
      max-height: 85dvh;
      overflow-y: auto;
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background: var(--surface-1);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-1);
    }
    .friends {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: 280px;
      overflow-y: auto;
    }
    .friend {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      border: 1px solid transparent;
      cursor: pointer;
      &:hover {
        background: var(--surface-2);
      }
      &.selected {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      &:focus-within {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }
    .note {
      display: grid;
      gap: var(--space-2);
      textarea {
        padding: var(--space-3);
        border-radius: var(--radius-md);
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
        resize: vertical;
      }
      .counter {
        justify-self: end;
      }
    }
    .error {
      color: var(--error);
      font-size: 0.875rem;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog implements OnInit {
  private readonly api = inject(SocialApi);
  protected readonly data = inject<ShareDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly noteMax = NOTE_MAX_LENGTH;
  protected readonly friends = signal<FriendInfo[] | null>(null);
  protected readonly selected = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.api.friends().subscribe({
      next: (friends) => this.friends.set(friends),
      error: () => {
        this.friends.set([]);
        this.failed.set(true);
      },
    });
  }

  protected send(event: Event): void {
    event.preventDefault();
    const friendId = this.selected();
    if (!friendId || this.sending()) return;
    this.sending.set(true);
    this.failed.set(false);
    this.api
      .shareMovie({ friendId, tmdbId: this.data.tmdbId, note: this.note().trim() || null })
      .subscribe({
        next: () => this.ref.close(true),
        error: () => {
          this.failed.set(true);
          this.sending.set(false);
        },
      });
  }
}

@Injectable({ providedIn: 'root' })
export class ShareDialogService {
  private readonly dialog = inject(Dialog);

  /** Resolves to true when the movie was sent. */
  async open(tmdbId: number, title: string): Promise<boolean> {
    const ref = this.dialog.open<boolean>(ShareDialog, {
      data: { tmdbId, title } satisfies ShareDialogData,
      backdropClass: 'dialog-backdrop',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
