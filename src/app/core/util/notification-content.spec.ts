import { describe, expect, it } from 'vitest';
import { NotificationItem } from '../models/social';
import { notificationContent } from './notification-content';

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;
const item = (
  type: string,
  data: Record<string, string>,
  content = 'server text',
): NotificationItem => ({
  id: 1,
  type,
  content,
  data,
  isRead: false,
});

describe('notificationContent', () => {
  it('opens the shared movie and includes the note', () => {
    const c = notificationContent(
      item('MOVIE_SHARED', {
        actorName: 'Ana',
        tmdbId: '603',
        movieTitle: 'Matrix',
        note: 'gledaj',
      }),
      t,
    );
    expect(c.link).toEqual(['/movie', 603]);
    expect(c.body).toContain('notif_movie_shared_body_with_note');
    expect(c.body).toContain('gledaj');
  });

  it("opens the new friend's profile", () => {
    const c = notificationContent(item('FRIEND_ACCEPTED', { actorName: 'Ana', actorId: 'u2' }), t);
    expect(c.link).toEqual(['/friends', 'u2']);
  });

  it('falls back to the server text for unknown or incomplete notifications', () => {
    expect(notificationContent(item('SOMETHING_NEW', {}), t).body).toBe('server text');
    // A like without a movie id cannot open anything specific.
    expect(notificationContent(item('COMMENT_LIKED', { actorName: 'Ana' }), t).link).toEqual([
      '/notifications',
    ]);
  });

  it('never builds a link from a malformed movie id', () => {
    const c = notificationContent(item('WATCHLIST_IN_CINEMA', { tmdbId: '../admin' }), t);
    expect(c.link).toEqual(['/notifications']);
  });
});
