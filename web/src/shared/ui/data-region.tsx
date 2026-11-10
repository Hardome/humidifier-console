import type { ReactNode } from 'react';

import { cn } from 'cn';

interface DataRegionProperties {
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isRefreshing?: boolean;
  readonly skeleton: ReactNode;
  readonly children: ReactNode;
}

export function DataRegion({
  isLoading,
  isFetching,
  isRefreshing = false,
  skeleton,
  children,
}: Readonly<DataRegionProperties>) {
  return (
    <section aria-label="Данные" aria-busy={isFetching} className="relative">
      {isLoading ? <div aria-hidden="true">{skeleton}</div> : <div inert={isRefreshing || undefined}>{children}</div>}
      {isFetching && (
        <div
          role="status"
          className={cn(
            'text-[11px] leading-[1.6] text-hint data-[refreshing=true]:absolute data-[refreshing=true]:inset-0',
            'data-[refreshing=true]:grid data-[refreshing=true]:place-items-center',
            'data-[refreshing=true]:bg-background/80',
          )}
          data-refreshing={isRefreshing}
        >
          {isLoading ? 'Загружаем…' : 'Обновляем…'}
        </div>
      )}
    </section>
  );
}
