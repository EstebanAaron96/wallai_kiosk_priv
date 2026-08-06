# wallAi Kiosco

Pantalla de kiosco de solo lectura para una única planta fotovoltaica. Sin
login, sin routing, sin estado persistente: consulta el backend Django de
wallAi usando un JWT de kiosco (scope `kiosk`, restringido a una planta) y
muestra datos en tiempo real e histórico del día.

## Arquitectura

- React 19 + TypeScript + Vite, sin router ni librería de estado.
- Todo el estilo es CSS Modules + variables CSS en [src/styles/theme.css](src/styles/theme.css); no hay dependencia de UI framework.
- La configuración de despliegue (`apiBaseUrl`, `kioskToken`, `plantLabel`) se lee en runtime desde `/config.json`, **nunca** se compila dentro del bundle. Esto significa que el mismo `dist/` sirve para cualquier planta/entorno: solo cambia el `config.json` que lo acompaña.
- El `plant_id` que se envía en cada petición no se configura a mano: se decodifica del propio `kioskToken` (claim `plant_id`) en [src/api/jwt.ts](src/api/jwt.ts), porque el backend rechaza (403) cualquier `plant_id` que no coincida exactamente con el del token.
- Los hooks de polling ([useKioskData](src/hooks/useKioskData.ts), [useKioskHistory](src/hooks/useKioskHistory.ts)) nunca borran el último dato válido ante un fallo de red transitorio; solo exponen `error`/`isStale` para que la UI lo muestre de forma discreta.
- `useKioskData` no usa un intervalo fijo: Mongo solo sincroniza cada 5 minutos (minutos ≡2 mod 5: xx:02, xx:07...), así que el poll se alinea a esa marca en vez de repetir la misma respuesta cada 30s.

## Diseño pensado para una pantalla 3840×2160 fija

El layout no es responsive de propósito general: está maquetado en `rem` con
`html { font-size: calc(100vw / 120) }` ([src/index.css](src/index.css)), una
referencia de diseño de 1920px de ancho (16:9). A 3840px reales de ancho
(2× 1920, mismo 16:9) todo escala x2 automáticamente y llena la pantalla del
MUPI sin recalcular nada; también escala bien si el navegador reporta 1920
lógicos con `devicePixelRatio` 2 en vez de 3840 físicos. Fuera de una ventana
16:9 el layout no reajusta su composición (los paneles están posicionados en
absoluto), así que para depurar en un monitor normal conviene forzar la
ventana del navegador a proporción 16:9.

## Desarrollo local

```bash
npm install
cp public/config.example.json public/config.json   # y rellena los valores reales
npm run dev
```

`public/config.json` está en `.gitignore` porque contiene un token real. `public/config.example.json` sí se versiona y documenta cada campo.

## Build de producción

```bash
npm run build
```

Genera `dist/`. El build es **agnóstico del token y de la planta**: no hornea ningún secreto ni URL en el JS. `dist/` se puede reutilizar para cualquier kiosco/planta con solo variar el `config.json` que lo acompaña en el servidor.

`vite.config.ts` desactiva explícitamente los sourcemaps en producción (`build.sourcemap: false`) para no exponer el código fuente en una pantalla pública.

## Despliegue

1. Copia el contenido de `dist/` al servidor/hosting estático del kiosco (Nginx, Cloud Run + servidor estático, etc.).
2. En ese mismo directorio raíz, crea `config.json` (no lo copies desde `dist/`, escríbelo directamente en destino) a partir de `config.example.json`:
   ```json
   {
     "apiBaseUrl": "https://backend.wallai.example.com",
     "kioskToken": "<JWT de kiosco emitido para esta planta>",
     "plantLabel": "Nombre de la planta"
   }
   ```
3. Sirve `dist/index.html` para cualquier ruta (SPA sin rutas internas, así que no hace falta configuración de fallback más allá de servir `index.html` en `/`).
4. Verifica que `GET /config.json` responde sin caché (o con caché corta) para que la rotación de token del paso siguiente no dependa de purgar CDN.

## Obtener un `kioskToken`

Se emite desde el backend Django (endpoint admin-only, ver Fase 1 del backend):

```
POST /api/data/kiosk_token/
```

con una sesión de admin autenticada y el `plant_id` deseado en el body. El token resultante tiene el scope `kiosk` y expira según `SIMPLE_JWT['KIOSK_TOKEN_LIFETIME']`.

## Rotación / revocación de token

- **Rotar**: genera un nuevo token con el endpoint anterior, sustituye el valor de `kioskToken` en el `config.json` del servidor y recarga la pantalla del kiosco (no hace falta rebuild ni redeploy del frontend).
- **Revocar de emergencia**: marca el `KioskToken` como inactivo (`is_active=False`) desde `/admin/` en el backend. El middleware de kiosco lo rechaza inmediatamente aunque el JWT siga siendo válido por firma/expiración. El frontend mostrará el error 403 correspondiente y seguirá reintentando hasta que se le entregue un token válido en `config.json`.

## Modo kiosco en el hardware

- Lanza Chrome/Chromium con `--kiosk --noerrdialogs --disable-infobars --incognito <url>` apuntando al despliegue.
- Configura un supervisor (systemd, pm2, o el gestor de ventanas) para **reiniciar el navegador si el proceso muere**, dado que la pantalla no tiene supervisión humana.
- La propia app incluye una red de seguridad en React ([ErrorBoundary](src/components/ErrorBoundary.tsx)) que se recupera sola de errores de render sin necesidad de recargar el navegador.
- El cursor se oculta automáticamente a los 5s de inactividad ([src/kiosk/idleCursor.ts](src/kiosk/idleCursor.ts)), y están deshabilitados el scroll, la selección de texto y el menú contextual ([src/styles/kiosk-hardening.css](src/styles/kiosk-hardening.css)).
