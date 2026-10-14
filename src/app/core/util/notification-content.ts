import { NotificationItem } from '../models/social';

export interface NotificationContent {
  icon: string;
  title: string;
  body: string;
  /** App route the notification opens (router commands). */
  link: (string | number)[];
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Text and destination of a stored notification, built from its type and data in the app's language
 * (the web counterpart of the Android PushNotifier.contentFor). Unknown or incomplete types fall back
 * to the text stored on the server.
 */
export function notificationContent(item: NotificationItem, t: Translate): NotificationContent {
  const data = item.data ?? {};
  const actor = data['actorName']?.trim() || t('profile_default_username');
  const actorId = data['actorId'];
  const tmdbId = Number(data['tmdbId']);
  const movie = data['movieTitle']?.trim() || '';
  const movieLink = Number.isInteger(tmdbId) && tmdbId > 0 ? ['/movie', tmdbId] : null;

  switch (item.type) {
    case 'FRIEND_REQUEST':
      return {
        icon: 'person_add',
        title: t('notif_friend_request_title'),
        body: t('notif_friend_request_body', { p1: actor }),
        link: ['/friends'],
      };
    case 'FRIEND_ACCEPTED':
      return {
        icon: 'how_to_reg',
        title: t('notif_friend_accepted_title'),
        body: t('notif_friend_accepted_body', { p1: actor }),
        link: actorId ? ['/friends', actorId] : ['/friends'],
      };
    case 'COMMENT_LIKED':
      if (movieLink)
        return {
          icon: 'favorite',
          title: t('notif_comment_liked_title'),
          body: movie
            ? t('notif_comment_liked_body', { p1: actor, p2: movie })
            : t('notif_comment_liked_body_no_movie', { p1: actor }),
          link: movieLink,
        };
      break;
    case 'MOVIE_SHARED':
      if (movieLink) {
        const note = data['note']?.trim();
        return {
          icon: 'movie',
          title: t('notif_movie_shared_title'),
          body: note
            ? t('notif_movie_shared_body_with_note', { p1: actor, p2: movie, p3: note })
            : t('notif_movie_shared_body', { p1: actor, p2: movie }),
          link: movieLink,
        };
      }
      break;
    case 'WATCHLIST_IN_CINEMA':
      if (movieLink)
        return {
          icon: 'theaters',
          title: t('notif_watchlist_cinema_title'),
          body: t('notif_watchlist_cinema_body', { p1: movie }),
          link: movieLink,
        };
      break;
  }
  return {
    icon: 'notifications',
    title: t('notifications_title'),
    body: item.content,
    link: movieLink ?? ['/notifications'],
  };
}
