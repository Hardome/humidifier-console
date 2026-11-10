import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChartNoAxesCombined, Droplets, LayoutDashboard, List, Settings, Workflow } from 'lucide-react';

import { ThemeSwitcher } from '@features/theme';
import { useDevice } from '@entities/humidifier';
import { Badge } from '@shared/ui/badge';

const navigation = [
  { to: '/', title: 'Обзор', icon: LayoutDashboard },
  { to: '/history', title: 'История', icon: ChartNoAxesCombined },
  { to: '/automations', title: 'Автоматизации', icon: Workflow },
  { to: '/events', title: 'События', icon: List },
  { to: '/settings', title: 'Настройки', icon: Settings },
] as const;

export function AppLayout() {
  const location = useRouterState({ select: (routerState) => routerState.location.pathname });

  const device = useDevice();

  const onlineLabel = device.data?.online && !device.data?.stale ? 'На связи' : 'Ожидание связи';

  return (
    <div className="grid min-h-screen grid-cols-[224px_minmax(0,1fr)] max-[1100px]:grid-cols-[190px_minmax(0,1fr)] max-[700px]:block">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-control focus:bg-card focus:px-4 focus:py-2"
      >
        Перейти к содержимому
      </a>
      <aside className="flex flex-col gap-[38px] bg-sidebar px-5 py-9 text-sidebar-foreground max-[700px]:gap-4 max-[700px]:px-4 max-[700px]:py-[15px] min-[701px]:sticky min-[701px]:top-0 min-[701px]:h-dvh min-[701px]:self-start min-[701px]:overflow-y-auto">
        <div className="flex items-center gap-2.5 text-[27px] font-[650] tracking-[-1px] max-[700px]:text-[22px] [&>svg]:size-8">
          <Droplets />
          smartmi
          <span className="text-xs font-normal tracking-normal opacity-60">home</span>
        </div>
        <nav
          className={cn(
            'flex flex-col gap-[9px]',
            'max-[700px]:fixed max-[700px]:inset-x-0 max-[700px]:bottom-0 max-[700px]:z-50',
            'max-[700px]:grid max-[700px]:grid-cols-5 max-[700px]:gap-0 max-[700px]:bg-sidebar',
            'max-[700px]:px-1 max-[700px]:pt-2 max-[700px]:pb-[calc(8px+env(safe-area-inset-bottom))]',
          )}
          aria-label="Основная навигация"
        >
          {navigation.map(({ to, title, icon: Icon }) => (
            <Link
              className={cn(
                'flex items-center gap-3 rounded-control px-4 py-3 text-sm text-sidebar-muted no-underline',
                'aria-[current=page]:bg-sidebar-active aria-[current=page]:text-sidebar-foreground',
                'max-[700px]:min-w-0 max-[700px]:flex-col max-[700px]:justify-center max-[700px]:gap-1',
                'max-[700px]:px-0.5 max-[700px]:py-2 max-[700px]:text-[9px] max-[700px]:tracking-tight',
                'max-[700px]:whitespace-nowrap [&>svg]:size-[19px]',
              )}
              key={to}
              to={to}
              aria-current={location === to ? 'page' : undefined}
            >
              <Icon />
              {title}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 max-[700px]:hidden">
          <div className="px-3 text-xs leading-[1.8] text-sidebar-caption max-[700px]:hidden">
            <span>Evaporative Humidifier 3 Lite</span>
          </div>
          <div className="rounded-lg bg-card p-2 text-card-foreground">
            <ThemeSwitcher />
          </div>
        </div>
      </aside>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1440px] self-start px-12 py-9 max-[1100px]:p-7 max-[700px]:px-4 max-[700px]:pt-6 max-[700px]:pb-[calc(96px+env(safe-area-inset-bottom))] min-[1600px]:px-16 min-[1600px]:py-12"
      >
        <header className="mb-[30px] flex items-center justify-between gap-4 max-[700px]:flex-wrap max-[700px]:items-start max-[700px]:gap-2">
          <div>
            <h1 className="text-[32px] font-medium tracking-[-1px] max-[700px]:text-[27px]">
              {navigation.find((navigationItem) => navigationItem.to === location)?.title ?? 'Страница не найдена'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 max-[700px]:justify-start">
            <Badge variant="outline">{onlineLabel}</Badge>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
