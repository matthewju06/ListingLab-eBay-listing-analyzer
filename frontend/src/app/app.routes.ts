import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/analyzer/analyzer').then((m) => m.AnalyzerComponent),
  },
  {
    path: 'saved',
    loadComponent: () => import('./pages/saved/saved').then((m) => m.SavedComponent),
  },
  {
    path: 'tracking',
    loadComponent: () => import('./pages/tracking/tracking').then((m) => m.TrackingComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
