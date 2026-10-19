import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FeedItem } from '../../core/models/social';
import { LanguageService } from '../../core/prefs/language.service';
import { LibraryStore } from '../../core/state/library.store';
import { formatTimeAgo } from '../../core/util/format';
import { tmdbImage } from '../../core/util/image-url';
import { SnackbarService } from '../../shared/ui/snackbar';
import { UserAvatar } from '../../shared/ui/user-avatar';

/**
 * One friends-feed card: who and when, the movie (poster and title), what they did (rating,
 * watched, comment with its text) and "Add to watchlist" when the movie is not on the user's
 * list or watched yet.
 */
@Component({
  selector: 'app-feed-card',
  imports: [TranslocoPipe, RouterLink, UserAvatar],
  template: `
    @let it = item();
    <article class="card">
      <header class="head">
        <a class="who" [routerLink]="['/friends', it.friend.id]">
          <app-user-avatar [url]="it.friend.avatar_url" [name]="it.friend.username" [size]="32" />
          <span class="name">{{ friendName() }}</span>
        </a>
        <time class="when" [attr.datetime]="isoTime()">{{ timeAgo() }}</time>
      </header>
      <div class="body">
        <a class="poster" [routerLink]="['/movie', it.tmdb_id]" tabindex="-1" aria-hidden="true">
          @if (poster(); as src) {
            <img [src]="src" alt="" width="64" height="96" loading="lazy" />
          } @else {
            <span class="icon">movie</span>
          }
        </a>
        <div class="info">
          <a class="title" [routerLink]="['/movie', it.tmdb_id]">{{ it.movie_title }}</a>
          <span class="what">
            @switch (it.type) {
              @case ('rated') {
                <span class="icon filled star" aria-hidden="true">star</span>
                {{ 'feed_rated' | transloco: { p1: it.rating } }}
              }
              @case ('commented') {
                <span class="icon" aria-hidden="true">comment</span>
                {{ 'feed_commented' | transloco }}
              }
              @default {
                <span class="icon" aria-hidden="true">visibility</span>
                {{ 'feed_watched' | transloco }}
              }
            }
          </span>
          @if (it.text) {
            <p class="text">„{{ it.text }}”</p>
          }
          @if (watchState() === 'none') {
            <button class="btn small" type="button" (click)="addToWatchlist()">
              <span class="icon" aria-hidden="true">bookmark_add</span>
              {{ 'feed_add_to_watchlist' | transloco }}
            </button>
          } @else if (watchState() === 'listed') {
            <span class="listed">
              <span class="icon filled" aria-hidden="true">bookmark_added</span>
              {{ 'feed_on_watchlist' | transloco }}
            </span>
          }
        </div>
      </div>
    </article>
  `,
  styleUrl: './feed-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedCard {
  private readonly library = inject(LibraryStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly snackbar = inject(SnackbarService);

  readonly item = input.required<FeedItem>();

  protected readonly poster = computed(() => tmdbImage(this.item().poster_path, 'w185'));
  protected readonly friendName = computed(
    () =>
      this.item().friend.username || this.transloco.translate<string>('profile_default_username'),
  );
  protected readonly timeAgo = computed(() =>
    formatTimeAgo(this.item().timestamp, this.language.language()),
  );
  protected readonly isoTime = computed(() => new Date(this.item().timestamp).toISOString());

  /** Watched movies need no button; listed ones show a quiet "On your list". */
  protected readonly watchState = computed<'none' | 'listed' | 'watched'>(() => {
    const id = this.item().tmdb_id;
    if (this.library.historyItem(id)) return 'watched';
    return this.library.isInWatchlist(id) ? 'listed' : 'none';
  });

  protected async addToWatchlist(): Promise<void> {
    const it = this.item();
    const ok = await this.library.toggleWatchlist({
      id: it.tmdb_id,
      title: it.movie_title,
      posterPath: it.poster_path,
    });
    if (!ok) this.snackbar.show(this.transloco.translate('error_server'));
  }
}
