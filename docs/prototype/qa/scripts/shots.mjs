// Capturas de tela (viewport) por rota/largura para revisao visual. Uso: node shots.mjs <largura>
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
const w = Number(process.argv[2] || 360);
const PLAN = {
  anon: ['/entrar', '/cadastro'],
  student: ['/itens', '/itens/item-01', '/itens/item-07', '/itens/item-10', '/itens/novo', '/itens/item-01/reivindicar', '/minhas-reivindicacoes'],
  admin: ['/admin', '/admin/reivindicacoes/claim-01', '/admin/reivindicacoes/claim-04', '/admin/itens/item-01/editar', '/admin/devolucoes', '/itens/item-05'],
};
const b = await launch();
for (const role of Object.keys(PLAN)) {
  const ctx = await newCtx(b, { viewport: { width: w, height: w < 768 ? 780 : 900 }, hasTouch: w < 768 });
  const page = await newPage(ctx);
  if (role !== 'anon') await demoLogin(page, role);
  for (const r of PLAN[role]) {
    await page.goto(BASE + r); await page.waitForLoadState('networkidle'); await sleep(1400);
    const name = `${role}${r.replace(/\//g, '_')}-${w}.png`;
    await page.screenshot({ path: `${OUT}/shots/${name}`, fullPage: w >= 768 });
  }
  await ctx.close();
}
await b.close();
