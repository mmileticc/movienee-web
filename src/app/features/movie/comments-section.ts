import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MovieApi } from '../../core/api/movie-api';
import { SessionStore } from '../../core/auth/session.store';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieComment } from '../../core/models/movie';
import { LanguageService } from '../../core/prefs/language.service';
import { formatTimestamp } from '../../core/util/format';
import { avatarUrl } from '../../core/util/image-url';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { SnackbarService } from '../../shared/ui/snackbar';
import { ErrorState } from '../../shared/ui/states';

const PAGE_SIZE = 3;
const MAX_LENGTH = 1000;

/**
 * Public comments on a movie (CommentsSection.kt): friends' comments first (sorted by the backend),
 * three at a time with "Show more". Posting, liking and deleting are optimistic: the change shows at
 * once and is rolled back if the server refuses (a rejected comment's text goes back into the field).
 * Guests see a sign-in link instead of the input.
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
  private readonly transloco = inject(TranslocoService);
  private readonly confirmService = inject(ConfirmService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly session = inject(SessionStore);
  protected readonly language = inject(LanguageService);

  readonly tmdbId = input.required<number>();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly comments = signal<MovieComment[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<FriendlyError | null>(null);
  protected readonly draft = signal('');
  /** Comment ids currently waiting for a like/unlike answer (one request per comment at a time). */
  protected readonly likePending = signal<ReadonlySet<number>>(new Set());
  /** Temporary (negative) ids of optimistic comments, so they never clash with real ones. */
  private nextTempId = -1;
  /** Optimistic comments deleted before the server confirmed them - deleted there once saved. */
  private readonly deletedBeforeSaved = new Set<number>();
  /**
   * How many rows the server has handed out so far: the offset of the next page. Comments posted here
   * are not counted (they do not move the server's paging the same way); duplicates are filtered out.
   */
  private serverOffset = 0;

  ngOnInit(): void {
    this.load(0);
  }

  protected load(offset: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.movieApi.comments(this.tmdbId(), offset, PAGE_SIZE).subscribe({
      next: (page) => {
        this.serverOffset = offset + page.comments.length;
        this.comments.update((list) => {
          if (offset === 0) return page.comments;
          const known = new Set(list.map((c) => c.id));
          return [...list, ...page.comments.filter((c) => !known.has(c.id))];
        });
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
    this.load(this.serverOffset);
  }

  protected post(event: Event): void {
    event.preventDefault();
    const body = this.draft().trim();
    const user = this.session.user();
    if (!body || !user) return;

    const tempId = this.nextTempId--;
    const optimistic: MovieComment = {
      id: tempId,
      user_id: user.id,
      username: user.username ?? this.transloco.translate('profile_default_username'),
      avatar_url: user.avatarUrl,
      body,
      created_at: Date.now(),
      like_count: 0,
      liked_by_me: false,
      is_friend: false,
      is_own: true,
    };
    this.comments.update((list) => [optimistic, ...list]);
    this.draft.set('');

    this.movieApi.addComment(this.tmdbId(), body).subscribe({
      next: (saved) => {
        if (this.deletedBeforeSaved.delete(tempId)) {
          this.movieApi.deleteComment(saved.id).subscribe();
          return;
        }
        this.comments.update((list) => list.map((c) => (c.id === tempId ? saved : c)));
      },
      error: () => {
        this.comments.update((list) => list.filter((c) => c.id !== tempId));
        // Already deleted by the user - nothing to give back.
        if (this.deletedBeforeSaved.delete(tempId)) return;
        if (!this.draft()) this.draft.set(body);
        this.snackbar.show(this.transloco.translate('movie_detail_comment_post_failed'));
      },
    });
  }

  protected toggleLike(comment: MovieComment): void {
    if (!this.session.isSignedIn()) {
      this.askToSignIn('movie_detail_comment_like_signin_toast');
      return;
    }
    if (comment.is_own || comment.id < 0 || this.likePending().has(comment.id)) return;
    const update = (liked: boolean, count: number) =>
      this.comments.update((list) =>
        list.map((c) =>
          c.id === comment.id ? { ...c, liked_by_me: liked, like_count: count } : c,
        ),
      );
    const setPending = (pending: boolean) =>
      this.likePending.update((current) => {
        const next = new Set(current);
        if (pending) next.add(comment.id);
        else next.delete(comment.id);
        return next;
      });
    // Taps are ignored while this comment's request runs, so the rollback below is always
    // relative to the state the server actually has.
    setPending(true);
    update(!comment.liked_by_me, comment.like_count + (comment.liked_by_me ? -1 : 1));
    this.movieApi.toggleCommentLike(comment.id).subscribe({
      next: (result) => {
        update(result.liked_by_me, result.like_count);
        setPending(false);
      },
      error: () => {
        update(comment.liked_by_me, comment.like_count);
        setPending(false);
      },
    });
  }

  protected async remove(comment: MovieComment): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: this.transloco.translate('movie_detail_comment_delete_dialog_title'),
      message: this.transloco.translate('movie_detail_comment_delete_dialog_message'),
      confirmLabel: this.transloco.translate('movie_detail_comment_delete_confirm'),
      cancelLabel: this.transloco.translate('movie_detail_comment_delete_cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    const index = this.comments().findIndex((c) => c.id === comment.id);
    this.comments.update((list) => list.filter((c) => c.id !== comment.id));
    // Not on the server yet: delete it there as soon as it is saved (see post()).
    if (comment.id < 0) {
      this.deletedBeforeSaved.add(comment.id);
      return;
    }
    this.movieApi.deleteComment(comment.id).subscribe({
      // The deleted row no longer counts in the server's paging.
      next: () => (this.serverOffset = Math.max(0, this.serverOffset - 1)),
      error: () => {
        // Put back only this comment, without undoing anything that happened meanwhile.
        this.comments.update((list) =>
          list.some((c) => c.id === comment.id)
            ? list
            : [...list.slice(0, index), comment, ...list.slice(index)],
        );
        this.snackbar.show(this.transloco.translate('error_server'));
      },
    });
  }

  protected signInLink(): { next: string } {
    return { next: this.router.url };
  }

  protected avatar(comment: MovieComment): string | null {
    return avatarUrl(comment.avatar_url);
  }

  protected date(createdAt: number): string {
    return formatTimestamp(createdAt, this.language.language());
  }

  private askToSignIn(messageKey: string): void {
    this.snackbar.show(this.transloco.translate(messageKey), {
      actionLabel: this.transloco.translate('profile_sign_in'),
      action: () => void this.router.navigate(['/sign-in'], { queryParams: this.signInLink() }),
    });
  }
}
