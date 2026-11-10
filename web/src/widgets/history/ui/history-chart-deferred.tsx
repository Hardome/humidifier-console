import { type ComponentProps, lazy, Suspense } from 'react';

const Chart = lazy(async () => {
  const module = await import('./history-chart');

  return { default: module.HistoryChart };
});

export function HistoryChart(properties: Readonly<ComponentProps<typeof Chart>>) {
  return (
    <Suspense
      fallback={
        <div role="status" className="h-[440px] max-[700px]:h-[380px]">
          Загрузка графика…
        </div>
      }
    >
      <Chart {...properties} />
    </Suspense>
  );
}
