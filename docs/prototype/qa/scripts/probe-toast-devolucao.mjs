import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
const b = await launch();
const ctx = await newCtx(b, { viewport: { width: 390, height: 844 } });
const pa = await newPage(ctx); await demoLogin(pa, 'admin');
await pa.goto(BASE + '/admin/reivindicacoes/claim-04'); await pa.waitForLoadState('networkidle'); await sleep(1200);
await pa.getByRole('button', { name: 'Registrar devolução' }).click();
await pa.getByRole('dialog').getByRole('button', { name: 'Registrar devolução' }).click();
const seen = [];
for (let i = 0; i < 40; i++) { const t = await pa.locator('div.animate-rise:has(button[aria-label="Dispensar aviso"])').allInnerTexts(); const u = new URL(pa.url()).pathname; seen.push(u + ' | ' + (t[0] || '').replace(/\n+/g, ' ')); await sleep(100); }
console.log([...new Set(seen)].join('\n'));
await pa.screenshot({ path: OUT + '/toast-devolucao-390.png' });
await b.close();
