// axe-core em rotas/estados + checagens estruturais (lang, h1, landmarks, title). Uso: node a11y.mjs
import fs from 'node:fs';
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep, axe } from './lib.mjs';
const DB = 'campuslost:proto:v1:db';
const b = await launch();
const report = [];
const struct = [];
const settle = async (p, ms = 1300) => { await p.waitForLoadState('networkidle'); await sleep(ms); };

async function structure(page, label) {
  const s = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null || getComputedStyle(h).position === 'fixed').length,
    h1text: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 40)),
    banner: document.querySelectorAll('header, [role=banner]').length,
    main: document.querySelectorAll('main, [role=main]').length,
    nav: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') || '(sem rótulo)'),
    contentinfo: document.querySelectorAll('footer, [role=contentinfo]').length,
    skip: !!document.querySelector('a[href="#conteudo"], a[href^="#main"], a[href^="#content"], a.sr-only, a[href^="#"]'),
    headings: [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.tagName + ':' + h.textContent.trim().slice(0, 25)),
  }));
  struct.push({ label, ...s });
  return s;
}
async function run(page, label) {
  const r = await axe(page, label);
  report.push(r);
  const crit = r.violations.map((v) => `${v.id}(${v.impact},${v.count})`).join(', ');
  console.log(`${r.violations.length ? 'VIOL ' : 'OK   '} ${label} ${crit}`);
  for (const v of r.violations) for (const n of v.nodes.slice(0, 2)) console.log(`        - ${v.id}: ${n.target} :: ${n.summary.slice(0, 160)}`);
  await structure(page, label);
}

for (const w of [390, 1280]) {
  const ctx = await newCtx(b, { viewport: { width: w, height: w < 768 ? 844 : 900 }, hasTouch: w < 768 });
  const tag = `${w}px`;
  const anon = await newPage(ctx);
  await anon.goto(BASE + '/entrar'); await settle(anon); await run(anon, `anon /entrar ${tag}`);
  await anon.getByRole('button', { name: 'Entrar', exact: true }).click(); await sleep(500); await run(anon, `anon /entrar com erro ${tag}`);
  await anon.getByLabel('E-mail').fill('ninguem@x.test'); await anon.getByRole('button', { name: 'Entrar', exact: true }).click(); await sleep(1200); await run(anon, `anon /entrar e-mail inexistente ${tag}`);
  await anon.getByRole('button', { name: /Reiniciar demonstração/ }).click(); await sleep(500); await run(anon, `anon /entrar diálogo reiniciar ${tag}`);
  await anon.keyboard.press('Escape');
  await anon.goto(BASE + '/cadastro'); await settle(anon, 600); await run(anon, `anon /cadastro ${tag}`);
  await anon.getByRole('button', { name: 'Criar conta' }).click(); await sleep(500); await run(anon, `anon /cadastro com erros ${tag}`);
  await anon.goto(BASE + '/rota-inexistente'); await settle(anon, 600); await run(anon, `404 ${tag}`);

  const s = await newPage(ctx); await demoLogin(s, 'student');
  await s.goto(BASE + '/itens', { waitUntil: 'commit' }); await sleep(150); await run(s, `student /itens skeleton ${tag}`);
  await settle(s); await run(s, `student /itens ${tag}`);
  if (w < 768) { await s.getByRole('button', { name: /^Filtros/ }).click(); await sleep(500); await run(s, `student /itens sheet filtros ${tag}`); await s.getByRole('dialog').getByLabel('Categoria').selectOption('Roupas'); await s.getByRole('dialog').getByRole('button', { name: 'Aplicar' }).click(); await sleep(1500); await run(s, `student /itens com chips ${tag}`); }
  await s.goto(BASE + '/itens?categoria=Documentos&local=Bloco+A'); await settle(s); await run(s, `student /itens sem resultados ${tag}`);
  await s.getByRole('button', { name: 'Menu da conta' }).click(); await sleep(300); await run(s, `student menu da conta aberto ${tag}`);
  await s.keyboard.press('Escape');
  for (const [r, n] of [['/itens/item-01', 'detalhe disponível (É meu)'], ['/itens/item-07', 'detalhe pendente'], ['/itens/item-05', 'detalhe aceita'], ['/itens/item-04', 'detalhe recusada'], ['/itens/item-10', 'detalhe devolvido'], ['/itens/nao-existe', 'item inexistente'], ['/itens/novo', 'registrar item'], ['/itens/item-01/reivindicar', 'reivindicar'], ['/itens/item-04/reivindicar', 'reivindicar bloqueado'], ['/minhas-reivindicacoes', 'minhas reivindicações'], ['/admin', 'acesso negado']]) {
    await s.goto(BASE + r); await settle(s); await run(s, `student ${n} ${tag}`);
  }
  await s.goto(BASE + '/itens/novo'); await settle(s, 600);
  await s.getByRole('button', { name: 'Registrar item' }).click(); await sleep(500); await run(s, `student registrar item com erros ${tag}`);
  await s.locator('input[type=file]').setInputFiles((process.env.QA_IMGS || new URL('./imgs', import.meta.url).pathname) + '/pequena-300x200.png'); await sleep(500); await run(s, `student registrar item com foto ${tag}`);
  await s.goto(BASE + '/itens/item-01/reivindicar'); await settle(s, 600);
  await s.getByRole('button', { name: 'Enviar reivindicação' }).click(); await sleep(500); await run(s, `student reivindicar com erros ${tag}`);

  const a = await newPage(ctx); await demoLogin(a, 'admin');
  for (const [r, n] of [['/admin', 'painel'], ['/admin/reivindicacoes/claim-01', 'análise pendente'], ['/admin/reivindicacoes/claim-04', 'análise aceita'], ['/admin/reivindicacoes/claim-03', 'análise recusada'], ['/admin/itens/item-01/editar', 'editar item'], ['/admin/itens/item-10/editar', 'editar devolvido (restrito)'], ['/admin/devolucoes', 'devoluções'], ['/itens/item-03', 'detalhe com reivindicações'], ['/itens/item-05', 'detalhe com aceita'], ['/itens/item-01/reivindicar', 'admin reivindicar bloqueado'], ['/minhas-reivindicacoes', 'admin minhas reivindicações']]) {
    await a.goto(BASE + r); await settle(a); await run(a, `admin ${n} ${tag}`);
  }
  await a.goto(BASE + '/admin/reivindicacoes/claim-01'); await settle(a, 600);
  await a.getByRole('button', { name: 'Aceitar', exact: true }).click(); await sleep(500); await run(a, `admin diálogo aceitar ${tag}`); await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Recusar', exact: true }).click(); await sleep(500); await run(a, `admin diálogo recusar ${tag}`); await a.keyboard.press('Escape');
  await a.goto(BASE + '/admin/reivindicacoes/claim-04'); await settle(a, 600);
  await a.getByRole('button', { name: 'Registrar devolução' }).click(); await sleep(500); await run(a, `admin diálogo devolução ${tag}`); await a.keyboard.press('Escape');
  await a.goto(BASE + '/admin/itens/item-01/editar'); await settle(a, 600);
  await a.getByRole('button', { name: 'Excluir item' }).first().click(); await sleep(500); await run(a, `admin diálogo excluir ${tag}`); await a.keyboard.press('Escape');
  await a.goto(BASE + '/admin/devolucoes'); await settle(a, 600);
  await a.getByLabel('Devolvido de').fill('2020-01-01'); await a.getByLabel(/^Devolvido até|^até/).first().fill('2020-01-02'); await sleep(1500); await run(a, `admin devoluções sem resultados ${tag}`);
  // erro de carregamento
  await a.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); d.returns[0].returnedToId = 'ghost'; localStorage.setItem(k, JSON.stringify(d)); }, DB);
  await a.goto(BASE + '/admin/devolucoes'); await settle(a, 1500); await run(a, `admin devoluções ErrorState ${tag}`);
  await a.evaluate((k) => localStorage.removeItem(k), DB);
  await a.goto(BASE + '/admin'); await settle(a);
  if (w < 768) { await a.getByRole('tab').nth(1).click(); await sleep(300); await run(a, `admin painel aba "Itens em reivindicação" ${tag}`); }
  // usuaria nova: vazio
  const n = await newPage(ctx); await n.goto(BASE + '/cadastro'); await settle(n, 500);
  await n.getByLabel('Nome completo').fill('Nova Pessoa'); await n.getByLabel('E-mail').fill(`nova${w}@teste.test`); await n.locator('label', { hasText: 'Aluno' }).click(); await n.getByRole('button', { name: 'Criar conta' }).click(); await n.waitForURL(/\/itens$/); await sleep(800);
  await n.goto(BASE + '/minhas-reivindicacoes'); await settle(n); await run(n, `novo usuário Minhas reivindicações vazio ${tag}`);
  // toast visivel
  await n.goto(BASE + '/itens/item-02/reivindicar'); await settle(n, 600);
  await n.getByLabel('Que detalhes só o dono saberia?').fill('Detalhe suficientemente longo.'); await n.getByLabel('Onde e quando você perdeu?').fill('Portaria ontem');
  await n.getByRole('button', { name: 'Enviar reivindicação' }).click(); await n.waitForURL(/minhas-reiv/); await sleep(700); await run(n, `toast de sucesso + lista ${tag}`);
  await ctx.close();
}
fs.writeFileSync(OUT + '/axe.json', JSON.stringify(report, null, 1));
fs.writeFileSync(OUT + '/structure.json', JSON.stringify(struct, null, 1));
const total = report.filter((r) => r.violations.length).length;
console.log(`\nTOTAL estados: ${report.length}; com violações: ${total}`);
const byId = {};
for (const r of report) for (const v of r.violations) { byId[v.id] ??= { impact: v.impact, help: v.help, estados: [] }; byId[v.id].estados.push(r.label); }
for (const [id, v] of Object.entries(byId)) console.log(`${id} (${v.impact}) ${v.help} :: ${v.estados.length} estados, ex.: ${v.estados.slice(0, 3).join('; ')}`);
await b.close();
