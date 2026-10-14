import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SocialApi } from '../../core/api/social-api';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { NotificationItem } from '../../core/models/social';
import { LanguageService } from '../../core/prefs/language.service';
import { SocialStore } from '../../core/state/social.store';
import { formatTimestamp } from '../../core/util/format';
import { notificationContent } from '../../core/util/notification-content';
import { PageTitle } from '../../core/util/page-title';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';

/**
 * Notification history (NotificationsScreen): everything that also arrives as a push. Items new on
 * this visit stay highlighted while the user is here; on the server they are marked read right away,
 * so the badge resets.
 */
@Component({
  selector: 'app-notifications',
  imports: [TranslocoPipe, RouterLink, ErrorState, EmptyState, Spinner],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(SocialApi);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);
  private readonly social = inject(SocialStore);

  protected readonly items = signal<NotificationItem[] | null>(null);
  protected readonly error = signal<FriendlyError | null>(null);
  /** Ids that were unread when the page opened. */
  private readonly fresh = signal<ReadonlySet<number>>(new Set());

  protected readonly entries = computed(() =>
    (this.items() ?? []).map((item) => ({
      item,
      content: notificationContent(item, (key, params) => this.transloco.translate(key, params)),
      isNew: this.fresh().has(item.id),
      date: item.createdAt ? formatTimestamp(item.createdAt, this.language.language()) : null,
    })),
  );

  constructor() {
    inject(PageTitle).set(this.transloco.translate('notifications_title'));
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.error.set(null);
    this.api.notifications().subscribe({
      next: (items) => {
        this.items.set(items);
        this.fresh.set(new Set(items.filter((n) => !n.isRead).map((n) => n.id)));
        this.social.notifications.set(items);
        this.social.markNotificationsRead();
      },
      error: (e) => this.error.set(friendlyError(e, 'notifications_load_failed')),
    });
  }
}
