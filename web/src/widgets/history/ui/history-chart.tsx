import { useState } from 'react';

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  type Plugin,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { historySettings } from '@entities/humidifier';
import { useTheme } from '@shared/lib/theme';
import { Toggle } from '@shared/ui/toggle';

import type { EventItem } from '@api/types/EventItem';
import type { HistoryPoint } from '@api/types/HistoryPoint';

import { createHumidityGuide, humidityGuide } from './humidity-guide';

// Регистрация шкал обязательна до первого рендера react-chartjs-2.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function withGaps(points: HistoryPoint[]) {
  const result: Array<HistoryPoint | { at: string; gap: true }> = [];

  for (const point of points) {
    const previous = result.at(-1);

    if (previous && new Date(point.at).getTime() - new Date(previous.at).getTime() > historySettings.gapThresholdMs) {
      result.push({
        at: new Date(new Date(previous.at).getTime() + historySettings.gapMarkerOffsetMs).toISOString(),
        gap: true,
      });
    }

    result.push(point);
  }

  return result;
}

interface HistoryChartProperties {
  readonly points: HistoryPoint[];
  readonly metric?: 'humidity' | 'temperature' | 'speed' | 'status';
  readonly events?: EventItem[];
  readonly showHumidityGuide?: boolean;
}

export function HistoryChart({
  points,
  metric = 'humidity',
  events = [],
  showHumidityGuide = true,
}: Readonly<HistoryChartProperties>) {
  useTheme();
  const [isGuideVisible, setGuideVisible] = useState(true);

  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(`--${name}`).trim();
  const values = withGaps(points);
  const eventMarkers: Plugin<'line'> = {
    id: 'event-markers',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      ctx.strokeStyle = color('chart-marker');
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);

      for (const event of events) {
        const at = new Date(event.at).getTime();

        if (
          values.length === 0 ||
          at < new Date(values[0].at).getTime() ||
          at > new Date(values.at(-1)?.at ?? 0).getTime()
        ) {
          continue;
        }

        const index = values.findIndex((point) => new Date(point.at).getTime() >= at);
        const markerX = scales.x?.getPixelForValue(index);
        const marker = new Path2D();
        marker.moveTo(markerX, chartArea.top);
        marker.lineTo(markerX, chartArea.bottom);
        ctx.stroke(marker);
      }

      ctx.restore();
    },
  };
  const title = {
    humidity: 'Влажность, %',
    temperature: 'Температура, °C',
    speed: 'Скорость, об/мин',
    status: 'Состояние · код',
  }[metric];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[360px] w-full max-[700px]:h-[300px]">
        <Line
          key={String(isGuideVisible)}
          plugins={
            metric === 'humidity' && showHumidityGuide && isGuideVisible
              ? [createHumidityGuide(color), eventMarkers]
              : [eventMarkers]
          }
          aria-label={title}
          role="img"
          data={{
            labels: values.map((point) =>
              new Date(point.at).toLocaleString('ru-RU', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
            ),
            datasets: [
              {
                label: title,
                data: values.map((point) => ('gap' in point ? null : point[metric])),
                borderColor: color('chart-line'),
                backgroundColor: color('chart-line'),
                borderWidth: 3,
                pointRadius: points.length === 1 ? 5 : 0,
                pointHoverRadius: 5,
                tension: 0.25,
                spanGaps: false,
                stepped: metric === 'status',
              },
              ...(metric === 'humidity'
                ? [
                    {
                      label: 'Целевая влажность',
                      data: values.map((point) => ('gap' in point ? null : point.target_humidity)),
                      borderColor: color('chart-target'),
                      borderDash: [5, 5],
                      borderWidth: 1.5,
                      pointRadius: 0,
                      spanGaps: false,
                    },
                  ]
                : []),
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: color('foreground'),
                  usePointStyle: true,
                  boxWidth: 10,
                  padding: 20,
                  font: { size: 13 },
                },
              },
              tooltip: { titleFont: { size: 14 }, bodyFont: { size: 14 }, padding: 12 },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: color('muted-foreground'),
                  maxTicksLimit: 4,
                  font: { size: 12 },
                  padding: 10,
                  maxRotation: 0,
                },
              },
              y: {
                grid: { color: color('chart-grid') },
                ticks: { color: color('muted-foreground'), font: { size: 12 }, padding: 10, maxTicksLimit: 7 },
                ...(metric === 'humidity' && { suggestedMin: 20, suggestedMax: 70 }),
              },
            },
          }}
        />
      </div>
      {metric === 'humidity' && showHumidityGuide && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Toggle variant="outline" pressed={isGuideVisible} onPressedChange={setGuideVisible}>
            Рекомендуемые границы
          </Toggle>
          {isGuideVisible && (
            <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Сухо &lt;{humidityGuide.dry}%</span>
              <span>
                Ориентир {humidityGuide.dry}–{humidityGuide.recommendedMaximum}%
              </span>
              <span>Очень влажно &gt;{humidityGuide.humid}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
