import type { Plugin } from 'chart.js';

// Ориентиры EPA для воздуха в помещении; они не меняют цель прибора.
export const humidityGuide = { dry: 30, recommendedMaximum: 50, humid: 60 } as const;

export function createHumidityGuide(color: (name: string) => string): Plugin<'line'> {
  return {
    id: 'humidity-guide',
    beforeDatasetsDraw({ ctx, chartArea, scales }) {
      const axis = scales.y;

      if (!axis) {
        return;
      }

      const lower = axis.getPixelForValue(humidityGuide.dry);
      const upper = axis.getPixelForValue(humidityGuide.recommendedMaximum);
      ctx.save();
      const clipping = new Path2D();
      clipping.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
      ctx.clip(clipping);
      ctx.fillStyle = color('chart-line');
      ctx.globalAlpha = 0.1;
      ctx.fillRect(chartArea.left, upper, chartArea.width, lower - upper);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      for (const boundary of Object.values(humidityGuide)) {
        const position = axis.getPixelForValue(boundary);
        ctx.strokeStyle = color(boundary === humidityGuide.humid ? 'error' : 'chart-marker');
        const line = new Path2D();
        line.moveTo(chartArea.left, position);
        line.lineTo(chartArea.right, position);
        ctx.stroke(line);
      }

      ctx.restore();
    },
  };
}
