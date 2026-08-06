import styles from './Hero.module.css';
import logoWallAi from '../assets/logo-wallai.png';
import logoKivel from '../assets/logo-kivel.png';

export interface HeroProps {
  name: string;
  address: string;
  isStale: boolean;
}

export function Hero({ name, address, isStale }: HeroProps) {
  return (
    <>
      <div className={styles.logos}>
        <img className={styles.brandLogo} src={logoWallAi} alt="Wall AI" />
        <img className={styles.partnerLogo} src={logoKivel} alt="Kivel" />
      </div>

      <div className={styles.heroCopy}>
        <div className={styles.kicker}>{name || 'Planta fotovoltaica'}</div>
        {address && <div className={styles.address}>{address}</div>}
        <h1 className={styles.title}>
          <span>La energía</span>
          <strong>en directo</strong>
        </h1>
        <div className={styles.live}>
          <i className={`${styles.liveDot} ${isStale ? styles.liveDotStale : ''}`} />
          {isStale ? 'Reconectando' : 'En directo'}
        </div>
      </div>
    </>
  );
}
