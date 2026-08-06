import styles from './DonutChart.module.css';

export interface DonutChartProps {
  /** 0-100 */
  percentSolar: number;
  /** Tamaño CSS (con unidad) del anillo renderizado, p.ej. "9.25rem". */
  size?: string;
}

// Coordenadas internas fijas del anillo (independientes del tamaño de
// renderizado, que se controla por fuera vía `size` en rem para escalar con
// el resto del layout a la resolución real de la pantalla).
const VIEWBOX_SIZE = 200;
const RADIUS = 74;
const STROKE_WIDTH = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ percentSolar, size = '9.25rem' }: DonutChartProps) {
  const clamped = Math.max(0, Math.min(100, percentSolar));
  const solarLength = (clamped / 100) * CIRCUMFERENCE;
  const center = VIEWBOX_SIZE / 2;

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg className={styles.ring} width={size} height={size} viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}>
        <circle className={styles.trackArc} cx={center} cy={center} r={RADIUS} strokeWidth={STROKE_WIDTH} />
        <circle
          className={styles.gridArc}
          cx={center}
          cy={center}
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={`${CIRCUMFERENCE - solarLength} ${solarLength}`}
          strokeDashoffset={-solarLength}
        />
        <circle
          className={styles.solarArc}
          cx={center}
          cy={center}
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={`${solarLength} ${CIRCUMFERENCE - solarLength}`}
        />
      </svg>
      <div className={styles.center}>
        <span className={styles.percent}>{clamped.toFixed(1).replace('.', ',')} %</span>
        <span className={styles.caption}>Solar</span>
      </div>
    </div>
  );
}
