// Configuració de Playwright per a les proves E2E del Rummikub.
// Necessita dos processos locals (vegeu README):
//   1. Servidor web:          python3 -m http.server 8080
//   2. Servidor PeerJS:       peerjs --port 9000 --key peerjs   (npm i -g peerjs-server)
// Després:  npx playwright install chromium   (una sola vegada)
//           npx playwright test               (o:  npm run e2e)
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,                       // els 2 "jugadors" comparteixen màquina; 1 worker evita interferències
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    browserName: 'chromium',        // un sol navegador (lleuger): només cal `playwright install chromium`
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
