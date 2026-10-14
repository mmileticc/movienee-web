import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

// Every screen is lazy-loaded. Screens not built yet use the temporary UnderConstructionPage; each
// phase of the plan replaces them with the real feature components.
const underConstruction = () =>
  import('./features/placeholder/under-construction.page').then((m) => m.UnderConstructionPage);

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
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'nav_friends' },
  },
  {
    path: 'friends/:friendId',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'nav_friends' },
  },
  {
    path: 'friends/:friendId/movie-night',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'nav_friends' },
  },
  {
    path: 'notifications',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'notifications_title' },
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
