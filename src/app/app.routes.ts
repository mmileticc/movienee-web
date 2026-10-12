import { Routes } from '@angular/router';

// Every screen is lazy-loaded. Screens not built yet use the temporary UnderConstructionPage; each
// phase of the plan replaces them with the real feature components.
const underConstruction = () =>
  import('./features/placeholder/under-construction.page').then((m) => m.UnderConstructionPage);

export const routes: Routes = [
  { path: '', title: 'Movienee', loadComponent: underConstruction, data: { titleKey: 'nav_home' } },
  {
    path: 'search',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'nav_search' },
  },
  {
    path: 'movie/:id',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'app_name' },
  },
  // Short alias used by shared links (https://<backend>/m/{tmdbId}).
  { path: 'm/:id', redirectTo: 'movie/:id' },
  {
    path: 'person/:id',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'app_name' },
  },
  {
    path: 'browse/suggested',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'home_section_personalized' },
  },
  {
    path: 'browse/now-in-cinemas',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'home_section_now_in_cinemas' },
  },
  {
    path: 'sign-in',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'profile_sign_in' },
  },
  {
    path: 'library',
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'nav_library' },
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
    title: 'Movienee',
    loadComponent: underConstruction,
    data: { titleKey: 'nav_profile' },
  },
  {
    path: '**',
    title: 'Movienee',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
