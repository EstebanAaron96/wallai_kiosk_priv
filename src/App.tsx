import { useKioskConfig } from './hooks/useKioskConfig';
import { useKioskData } from './hooks/useKioskData';
import { useKioskAccumulated } from './hooks/useKioskAccumulated';
import { Hero } from './components/Hero';
import { EnergyFlowDiagram } from './components/EnergyFlowDiagram';
import { AccumulatedPanel } from './components/AccumulatedPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import styles from './App.module.css';

function KioskApp() {
  const { config, isLoading: isConfigLoading, error: configError } = useKioskConfig();
  const { data, error: dataError, isStale } = useKioskData(config);
  const { year, month } = useKioskAccumulated(config);

  if (isConfigLoading) {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.brandSplash}>Wall AI</div>
        <div className={styles.spinner} />
        <div className={styles.errorDetail}>Cargando configuración del kiosco…</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.brandSplash}>Wall AI</div>
        <div className={styles.errorTitle}>No se pudo iniciar el kiosco</div>
        <div className={styles.errorDetail}>{configError}</div>
        <div className={styles.errorDetail}>
          Revisa public/config.json en el servidor de despliegue (ver config.example.json) y recarga
          la página.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.brandSplash}>{config?.plantLabel || 'Wall AI'}</div>
        <div className={styles.spinner} />
        <div className={styles.errorDetail}>
          {dataError ?? 'Cargando datos de la planta…'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.ambient} />
      <Hero name={data.name} address={data.address} isStale={isStale} />
      <EnergyFlowDiagram flow={data.energy_flow_data ?? null} />
      <AccumulatedPanel year={year} month={month} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <KioskApp />
    </ErrorBoundary>
  );
}

export default App;
