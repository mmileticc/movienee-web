import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

// Every screen is lazy-loaded; screens that need an account are behind authGuard.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'movie/:id',
    loadComponent: () =>
      import('./features/movie/movie-detail.page').then((m) => m.MovieDetailPage),
  },
  // Short alias used by shared links (https://<backend>/m/{tmdbId}).
  { path: 'm/:id', redirectTo: 'movie/:id' },
  {
    path: 'person/:id',
    loadComponent: () => import('./features/person/person.page').then((m) => m.PersonPage),
  },
  {
    path: 'browse/suggested',
    loadComponent: () => import('./features/browse/suggested.page').then((m) => m.SuggestedPage),
  },
  {
    path: 'browse/now-in-cinemas',
    loadComponent: () =>
      import('./features/browse/now-in-cinemas.page').then((m) => m.NowInCinemasPage),
  },
  {
    path: 'sign-in',
    loadComponent: () => import('./features/sign-in/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: 'library',
    canActivate: [authGuard],
    loadComponent: () => import('./features/library/library.page').then((m) => m.LibraryPage),
  },
  {
    path: 'friends',
    canActivate: [authGuard],
    loadComponent: () => import('./features/friends/friends.page').then((m) => m.FriendsPage),
  },
  {
    path: 'friends/:friendId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/friends/friend-profile.page').then((m) => m.FriendProfilePage),
  },
  {
    path: 'friends/:friendId/movie-night',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/friends/movie-night.page').then((m) => m.MovieNightPage),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/notifications/notifications.page').then((m) => m.NotificationsPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: '**',
    title: 'Movienee',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
