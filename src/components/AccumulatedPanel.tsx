import type { AccumulatedPeriod } from '../hooks/useKioskAccumulated';
import { DonutChart } from './DonutChart';
import styles from './AccumulatedPanel.module.css';

export interface AccumulatedPanelProps {
  year: AccumulatedPeriod | null;
  month: AccumulatedPeriod | null;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatKwh(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentMonthLabel(): { title: string; range: string } {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthName = MONTH_NAMES[now.getMonth()];
  return {
    title: monthName,
    range: `1-${lastDay} ${monthName.slice(0, 3).toUpperCase()}`,
  };
}

interface PeriodCardProps {
  title: string;
  range: string;
  period: AccumulatedPeriod | null;
}

function PeriodCard({ title, range, period }: PeriodCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.headRow}>
        <span className={styles.title}>{title}</span>
        <span className={styles.period}>{range}</span>
      </div>
      {period === null ? (
        <div className={styles.loading}>
          <span className={styles.loadingRing} />
          Cargando acumulado…
        </div>
      ) : (
        <div className={styles.body}>
          <DonutChart percentSolar={period.percentSolar} size="13rem" />
          <div className={styles.rows}>
            <div className={`${styles.row} ${styles.rowSolar}`}>
              <span className={styles.swatch} />
              <span className={styles.name}>Generada por nuestras placas</span>
              <span className={styles.amount}>
                {formatKwh(period.solarKwh)}
                <span className={styles.unit}>kWh</span>
              </span>
            </div>
            <div className={`${styles.row} ${styles.rowGrid}`}>
              <span className={styles.swatch} />
              <span className={styles.name}>Procedente de la red</span>
              <span className={styles.amount}>
                {formatKwh(period.gridKwh)}
                <span className={styles.unit}>kWh</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function AccumulatedPanel({ year, month }: AccumulatedPanelProps) {
  const monthLabel = currentMonthLabel();
  const currentYear = new Date().getFullYear();

  return (
    <div className={styles.panel}>
      <PeriodCard title={`Energía ${currentYear}`} range="ENE-DIC" period={year} />
      <PeriodCard title={monthLabel.title} range={monthLabel.range} period={month} />
    </div>
  );
}
