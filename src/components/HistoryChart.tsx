import type { PlantHistoryPoint } from '../types/PlantData';
import styles from './HistoryChart.module.css';

export interface HistoryChartProps {
  points: PlantHistoryPoint[];
}

const VIEW_W = 100;
const VIEW_H = 40;
const PAD_Y = 3;

function buildPolyline(values: number[], maxValue: number): string {
  if (values.length === 0) return '';
  const step = values.length > 1 ? VIEW_W / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * step;
      const ratio = maxValue > 0 ? v / maxValue : 0;
      const y = VIEW_H - PAD_Y - ratio * (VIEW_H - PAD_Y * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function formatHour(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HistoryChart({ points }: HistoryChartProps) {
  const solar = points.map((p) => p.solarOutputKw);
  const grid = points.map((p) => p.gridConsumptionKw);
  const maxValue = Math.max(1, ...solar, ...grid);

  const firstLabel = points[0] ? formatHour(points[0].timestamp) : '';
  const lastLabel = points.length > 0 ? formatHour(points[points.length - 1].timestamp) : '';

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <span className={styles.title}>Histórico de hoy</span>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchSolar}`} />
            Fotovoltaica
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchGrid}`} />
            Red
          </span>
        </div>
      </div>

      <div className={styles.chartArea}>
        {points.length === 0 ? (
          <div className={styles.empty}>Sin datos históricos todavía</div>
        ) : (
          <svg className={styles.svg} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
            <polyline
              className={styles.line}
              points={buildPolyline(solar, maxValue)}
              vectorEffect="non-scaling-stroke"
              style={{ stroke: 'var(--color-solar-dark)' }}
            />
            <polyline
              className={styles.line}
              points={buildPolyline(grid, maxValue)}
              vectorEffect="non-scaling-stroke"
              style={{ stroke: 'var(--color-grid-dark)' }}
            />
          </svg>
        )}
      </div>
      {points.length > 0 && (
        <div className={styles.axisRow}>
          <span>{firstLabel}</span>
          <span>{lastLabel}</span>
        </div>
      )}
    </div>
  );
}
