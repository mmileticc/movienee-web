import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MovieApi } from '../../core/api/movie-api';
import { SessionStore } from '../../core/auth/session.store';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieComment } from '../../core/models/movie';
import { LanguageService } from '../../core/prefs/language.service';
import { avatarUrl } from '../../core/util/image-url';
import { ErrorState } from '../../shared/ui/states';

const PAGE_SIZE = 3;

/**
 * Public comments on a movie (CommentsSection.kt): friends' comments first (sorted by the backend),
 * three at a time with "Show more". Writing, liking and deleting come with the account features;
 * guests see a sign-in link instead of the input.
 */
@Component({
  selector: 'app-comments-section',
  imports: [TranslocoPipe, RouterLink, ErrorState],
  templateUrl: './comments-section.html',
  styleUrl: './comments-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentsSection implements OnInit {
  private readonly movieApi = inject(MovieApi);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly language = inject(LanguageService);

  readonly tmdbId = input.required<number>();

  protected readonly comments = signal<MovieComment[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<FriendlyError | null>(null);

  ngOnInit(): void {
    this.load(0);
  }

  protected load(offset: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.movieApi.comments(this.tmdbId(), offset, PAGE_SIZE).subscribe({
      next: (page) => {
        this.comments.update((list) =>
          offset === 0 ? page.comments : [...list, ...page.comments],
        );
        this.hasMore.set(page.has_more);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(friendlyError(e, 'error_server'));
        this.loading.set(false);
      },
    });
  }

  protected loadMore(): void {
    this.load(this.comments().length);
  }

  protected signInLink(): { next: string } {
    return { next: this.router.url };
  }

  protected avatar(comment: MovieComment): string | null {
    return avatarUrl(comment.avatar_url);
  }

  protected date(createdAt: number): string {
    return new Intl.DateTimeFormat(this.language.language() === 'sr' ? 'sr-Latn-RS' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(createdAt));
  }
}
