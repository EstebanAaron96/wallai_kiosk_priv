import type { ReactNode } from 'react';
import styles from './EnergyCard.module.css';

export type EnergyCardAccent = 'solar' | 'grid' | 'load';

export interface EnergyCardProps {
  icon: ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  accent: EnergyCardAccent;
}

const ACCENT_CLASS: Record<EnergyCardAccent, string> = {
  solar: styles.accentSolar,
  grid: styles.accentGrid,
  load: styles.accentLoad,
};

export function EnergyCard({ icon, label, value, unit, accent }: EnergyCardProps) {
  return (
    <div className={styles.card}>
      <div className={`${styles.iconWrap} ${ACCENT_CLASS[accent]}`}>{icon}</div>
      <div className={styles.body}>
        <span className={styles.label}>{label}</span>
        <span className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </span>
      </div>
    </div>
  );
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M12 22v-6M5 9l7-3 7 3-7 3-7-3z" />
      <path d="M5 9v6l7 3 7-3V9" />
    </svg>
  );
}

export function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
