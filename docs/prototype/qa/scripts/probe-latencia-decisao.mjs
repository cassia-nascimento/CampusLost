import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
const b = await launch();
const ctx = await newCtx(b, { viewport: { width: 1280, height: 900 } });
const pa = await newPage(ctx); await demoLogin(pa, 'admin');
async function timeline(label, trigger, confirmName, url) {
  await pa.goto(BASE + url); await pa.waitForLoadState('networkidle'); await sleep(1200);
  await pa.getByRole('button', { name: trigger, exact: true }).click();
  const t0 = Date.now();
  await pa.getByRole('dialog').getByRole('button', { name: confirmName }).click();
  const ev = []; let last = '';
  for (let i = 0; i < 160; i++) {
    const s = await pa.evaluate(() => { const d = document.querySelector('dialog[open]'); const btns = d ? [...d.querySelectorAll('button')].map((x) => x.textContent.trim().replace(/\s+/g, ' ')).join('/') : '(fechado)'; const toast = document.querySelector('div.animate-rise')?.textContent?.slice(0, 40) || ''; return `${location.pathname} | dlg=${btns} | toast=${toast}`; });
    if (s !== last) { ev.push(`${Date.now() - t0} ms  ${s}`); last = s; }
    await sleep(50);
  }
  console.log('--', label); console.log(ev.join('\n'));
}
await timeline('Recusar claim-07', 'Recusar', 'Recusar reivindicação', '/admin/reivindicacoes/claim-07');
await timeline('Aceitar claim-06', 'Aceitar', 'Aceitar reivindicação', '/admin/reivindicacoes/claim-06');
await b.close();
