import { useKioskConfig } from './hooks/useKioskConfig';
import { useKioskData } from './hooks/useKioskData';
import { useKioskAccumulated } from './hooks/useKioskAccumulated';
import { Scene3D } from './casino/Scene3D';
import { toEnergySnapshot } from './casino/toEnergySnapshot';
import { ErrorBoundary } from './components/ErrorBoundary';
import styles from './App.module.css';

function KioskApp() {
  const { config, isLoading: isConfigLoading, error: configError } = useKioskConfig();
  const { data } = useKioskData(config);
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

  return (
    <Scene3D
      snapshot={data ? toEnergySnapshot(data, year, month) : null}
      yearReady={year !== null}
      monthReady={month !== null}
    />
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
