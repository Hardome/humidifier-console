import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';

import { EventsPage, eventsSearchSchema } from '@pages/events';
import { HistoryPage, historySearchSchema } from '@pages/history';
import { OverviewPage } from '@pages/overview';

import { AppLayout } from '../layout/app-layout';

const root = createRootRoute({ component: AppLayout });

const routeTree = root.addChildren([
  createRoute({
    getParentRoute: () => root,
    path: '/',
    component: OverviewPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/history',
    validateSearch: (search) => historySearchSchema.parse(search),
    component: HistoryPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/automations',
    component: lazyRouteComponent(() => import('@pages/automations'), 'AutomationsPage'),
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/events',
    validateSearch: (search) => eventsSearchSchema.parse(search),
    component: EventsPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/settings',
    component: lazyRouteComponent(() => import('@pages/settings'), 'SettingsPage'),
  }),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
