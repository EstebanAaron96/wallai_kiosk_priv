// Genera public/config.json a partir de variables de entorno antes del
// build, para poder desplegar en Vercel (u otro host) sin subir el
// kioskToken al repositorio. En desarrollo local basta con copiar
// public/config.example.json a public/config.json a mano.
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'config.json');

const apiBaseUrl = process.env.KIOSK_API_BASE_URL;
const kioskToken = process.env.KIOSK_TOKEN;
const plantLabel = process.env.KIOSK_PLANT_LABEL;

if (!apiBaseUrl || !kioskToken) {
  if (existsSync(outPath)) {
    console.log('[generate-config] KIOSK_API_BASE_URL/KIOSK_TOKEN no definidos; se conserva public/config.json existente.');
    process.exit(0);
  }
  console.warn(
    '[generate-config] KIOSK_API_BASE_URL/KIOSK_TOKEN no definidos y no hay public/config.json local: ' +
      'el build continúa, pero el kiosco mostrará el error de configuración hasta que se sirva un config.json válido.',
  );
  process.exit(0);
}

const config = { apiBaseUrl, kioskToken, ...(plantLabel ? { plantLabel } : {}) };
writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n');
console.log(`[generate-config] public/config.json generado para ${apiBaseUrl}.`);
