// Matriz de permissoes rota x papel. Uso: node permissions.mjs
import fs from 'node:fs';
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
const b = await launch();
const ROUTES = [
  '/', '/entrar', '/cadastro', '/itens', '/itens/item-01', '/itens/item-03', '/itens/item-10', '/itens/novo',
  '/itens/item-01/reivindicar', '/minhas-reivindicacoes', '/admin', '/admin/reivindicacoes/claim-01',
  '/admin/itens/item-01/editar', '/admin/devolucoes', '/rota-inexistente',
];
const ROLES = ['anon', 'student', 'teacher', 'admin'];
const rows = [];
for (const role of ROLES) {
  const ctx = await newCtx(b, { viewport: { width: 1280, height: 900 } });
  const page = await newPage(ctx);
  if (role !== 'anon') await demoLogin(page, role);
  for (const r of ROUTES) {
    await page.goto(BASE + r);
    await page.waitForLoadState('networkidle');
    await sleep(1300);
    const final = new URL(page.url()).pathname;
    const h1 = await page.locator('h1').allInnerTexts();
    const headerNav = await page.locator('header nav a, header a').allInnerTexts().catch(() => []);
    const btn = async (re) => (await page.getByRole('button', { name: re }).count()) + (await page.getByRole('link', { name: re }).count());
    const row = {
      role, route: r, final, h1: h1.join(' / ').slice(0, 60),
      emMeu: await page.getByText('É meu', { exact: true }).count(),
      regDev: await btn(/Registrar devolução/),
      editar: await btn(/^Editar/),
      excluir: await btn(/^Excluir/),
      aceitar: await page.getByRole('button', { name: 'Aceitar', exact: true }).count(),
      body: (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 110),
    };
    rows.push(row);
    console.log(role.padEnd(8), r.padEnd(34), '->', final.padEnd(34), JSON.stringify({ h1: row.h1, emMeu: row.emMeu, regDev: row.regDev, ed: row.editar, ex: row.excluir, ac: row.aceitar }));
  }
  // Navegacao visivel (desktop)
  if (role !== 'anon') {
    await page.goto(BASE + (role === 'admin' ? '/admin' : '/itens')); await page.waitForLoadState('networkidle'); await sleep(1200);
    const nav = await page.locator('header nav[aria-label] a, header nav a').allInnerTexts();
    const hdrBtns = await page.locator('header').getByRole('link').allInnerTexts();
    console.log('  NAV desktop', role, JSON.stringify(nav), 'links header:', JSON.stringify(hdrBtns));
    rows.push({ role, route: '(nav desktop)', nav, hdrBtns });
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(500);
    const bn = await page.locator('nav[aria-label="Principal"]').last().getByRole('link').allInnerTexts().catch(() => []);
    console.log('  BOTTOMNAV 390', role, JSON.stringify(bn));
    rows.push({ role, route: '(bottomnav 390)', bn });
    // /entrar logado
    await page.goto(BASE + '/entrar'); await sleep(1500);
    console.log('  /entrar logado ->', new URL(page.url()).pathname);
    await page.goto(BASE + '/cadastro'); await sleep(1500);
    console.log('  /cadastro logado ->', new URL(page.url()).pathname);
  }
  console.log('  console', role, JSON.stringify(page.consoleMsgs));
  await ctx.close();
}
fs.writeFileSync(OUT + '/permissions.json', JSON.stringify(rows, null, 1));
await b.close();
