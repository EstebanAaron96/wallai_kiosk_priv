import type { EnergyFlowData } from '../types/PlantData';
import styles from './EnergyFlowDiagram.module.css';
import buildingImg from '../assets/building-model.png';
import gridImg from '../assets/grid-substation.png';
import pvImg from '../assets/pv-module.png';

export interface EnergyFlowDiagramProps {
  flow: EnergyFlowData | null;
}

interface Point {
  x: number;
  y: number;
}

const GRID_ICON: Point = { x: 13, y: 37 };
const SOLAR_ICON: Point = { x: 90, y: 33 };
const MERGE: Point = { x: 50, y: 64 };
const GROUND: Point = { x: 50, y: 84 };
const BATTERY_ICON: Point = { x: 90, y: 62 };

function cubicPath(a: Point, b: Point, bend: number): string {
  const c1 = { x: a.x, y: a.y + (b.y - a.y) * bend };
  const c2 = { x: b.x, y: a.y + (b.y - a.y) * (1 - bend * 0.5) };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

/** Arco que sube por encima de ambos puntos, para separar visualmente el
 * excedente vendido a red (arriba) del consumo que baja al edificio. */
function arcOverPath(a: Point, b: Point, lift: number): string {
  const midX = (a.x + b.x) / 2;
  const midY = Math.min(a.y, b.y) - lift;
  return `M ${a.x} ${a.y} Q ${midX} ${midY}, ${b.x} ${b.y}`;
}

function offsetPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

function formatKw(value: number | undefined): string {
  return (value ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BatteryGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="20" width="36" height="28" rx="4" />
      <path d="M48 28h4v12h-4" />
      <path d="M28 26 20 38h8l-4 10 12-14h-8z" />
    </svg>
  );
}

interface FlowLine {
  id: string;
  d: string;
  secondaryD?: string;
  active: boolean;
  colorVar: string;
  isLoad?: boolean;
}

function gridNoteText(flow: EnergyFlowData | null): string {
  if (flow?.pr) return 'Excedente que vendemos';
  if (flow?.rc) return 'Energía que recibimos';
  return 'Sin intercambio con la red';
}

export function EnergyFlowDiagram({ flow }: EnergyFlowDiagramProps) {
  const hasBattery = flow?.hasBattery ?? false;
  const hasConsumptionFlow = !!(flow?.pc || flow?.rc || flow?.bc);

  const lines: FlowLine[] = [
    {
      id: 'grid-merge',
      d: cubicPath(GRID_ICON, MERGE, 0.75),
      secondaryD: cubicPath(offsetPoint(GRID_ICON, -3, 4), offsetPoint(MERGE, 0, -4), 0.7),
      active: !!(flow?.rc || flow?.pb),
      colorVar: 'var(--color-grid)',
    },
    {
      id: 'solar-merge',
      d: cubicPath(SOLAR_ICON, MERGE, 0.75),
      secondaryD: cubicPath(offsetPoint(SOLAR_ICON, 3, 4), offsetPoint(MERGE, 0, -4), 0.7),
      active: !!flow?.pc,
      colorVar: 'var(--color-solar)',
    },
    {
      id: 'merge-ground',
      d: `M ${MERGE.x} ${MERGE.y} L ${GROUND.x} ${GROUND.y}`,
      active: hasConsumptionFlow,
      colorVar: 'rgba(245,242,236,.46)',
      isLoad: true,
    },
    // Excedente vendido a la red: arco POR ENCIMA de la escena, en sentido
    // contrario (solar -> red), para no confundirlo con el consumo desde red.
    {
      id: 'solar-grid-sell',
      d: arcOverPath(SOLAR_ICON, GRID_ICON, 16),
      active: !!flow?.pr,
      colorVar: 'var(--color-solar)',
    },
  ];

  if (hasBattery) {
    lines.push({
      id: 'grid-batt',
      d: cubicPath(GRID_ICON, BATTERY_ICON, 0.6),
      active: !!(flow?.pb || flow?.rb),
      colorVar: 'var(--color-grid)',
    });
  }

  return (
    <div className={styles.stage}>
      <div className={styles.ground} />

      <svg className={styles.svgLayer} viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((line) => (
          <path
            key={line.id}
            d={line.d}
            vectorEffect="non-scaling-stroke"
            className={`${styles.flowPath} ${line.isLoad ? styles.load : ''} ${line.active ? styles.flowPathActive : ''}`}
            style={line.isLoad ? undefined : { stroke: line.colorVar }}
          />
        ))}
        {lines
          .filter((line) => line.secondaryD)
          .map((line) => (
            <path
              key={`secondary-${line.id}`}
              d={line.secondaryD}
              vectorEffect="non-scaling-stroke"
              className={`${styles.flowPath} ${styles.secondary} ${line.active ? styles.flowPathActive : ''}`}
              style={{ stroke: line.colorVar }}
            />
          ))}
        {lines
          .filter((line) => line.active && !line.isLoad)
          .map((line) => (
            <circle key={`dot-${line.id}`} r="0.7" className={`${styles.pulseDot} ${styles.pulseDotActive}`} style={{ fill: line.colorVar, color: line.colorVar }}>
              <animateMotion dur="5.6s" repeatCount="indefinite" path={line.d} />
            </circle>
          ))}
      </svg>

      <div className={styles.buildingWrap}>
        <img className={styles.buildingImg} src={buildingImg} alt="Edificio" />
      </div>

      <div className={styles.photoNode} style={{ left: `${GRID_ICON.x}%`, top: `${GRID_ICON.y}%` }}>
        <img className={`${styles.photoImg} ${styles.grid}`} src={gridImg} alt="Conexión a la red eléctrica" />
      </div>
      <div className={styles.photoNode} style={{ left: `${SOLAR_ICON.x}%`, top: `${SOLAR_ICON.y}%` }}>
        <img className={`${styles.photoImg} ${styles.solar}`} src={pvImg} alt="Panel fotovoltaico" />
      </div>
      {hasBattery && (
        <div className={styles.photoNode} style={{ left: `${BATTERY_ICON.x}%`, top: `${BATTERY_ICON.y}%` }}>
          <div className={styles.batteryGlyph}>
            <BatteryGlyph />
          </div>
        </div>
      )}

      <div className={`${styles.metric} ${styles.grid}`} style={{ left: '6%', top: '13%' }}>
        <div className={styles.label}>
          <span className={styles.dot} />
          Red eléctrica
        </div>
        <div className={styles.value}>
          {formatKw(flow?.gridKw)}
          <span className={styles.unit}>kW</span>
        </div>
        <div className={styles.note}>{gridNoteText(flow)}</div>
      </div>

      <div className={`${styles.metric} ${styles.solar}`} style={{ right: '3%', top: '9%' }}>
        <div className={styles.label}>
          <span className={styles.dot} />
          Generación solar
        </div>
        <div className={styles.value}>
          {formatKw(flow?.pvKw)}
          <span className={styles.unit}>kW</span>
        </div>
        <div className={styles.note}>Energía que generamos</div>
      </div>

      <div className={`${styles.metric} ${styles.load}`} style={{ left: '50%', top: '78%', transform: 'translateX(-50%)', width: '32%', textAlign: 'center' }}>
        <div className={styles.label} style={{ justifyContent: 'center' }}>
          <span className={styles.dot} />
          Consumo
        </div>
        <div className={styles.value}>
          {formatKw(flow?.loadKw)}
          <span className={styles.unit}>kW</span>
        </div>
        <div className={styles.note} style={{ maxWidth: 'none', marginLeft: 'auto', marginRight: 'auto' }}>
          Energía que utilizamos
        </div>
        {hasBattery && (
          <div className={styles.batteryBarTrack}>
            <div className={styles.batteryBarFill} style={{ width: `${Math.min(100, Math.max(0, flow?.battPct ?? 0))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
