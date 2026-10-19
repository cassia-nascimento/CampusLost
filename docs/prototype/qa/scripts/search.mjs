// Busca e filtros (AC03.x). Uso: node search.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('search');
const b = await launch();
const ctx = await newCtx(b, { viewport: { width: 1280, height: 900 } });
const page = await newPage(ctx);
await demoLogin(page, 'student');
const titles = async () => page.locator('main ul a[href^="/itens/"] h2, main ul a[href^="/itens/"] h3').allInnerTexts();
const settle = async () => { await page.waitForLoadState('networkidle'); await sleep(1300); };
const count = async () => (await page.locator('main [aria-live=polite]').allInnerTexts()).join('|');
const dayStr = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
const filt = (label) => page.locator('section[aria-label="Filtros da busca"] >> visible=true').getByLabel(label, { exact: true });

await page.goto(BASE + '/itens'); await settle();
const all = await titles();
await check('AC03.2b', 'Sem filtro: 9 itens, devolvidos (Mochila preta, Carregador USB-C) ausentes; "Em reivindicação" identificado', async () => {
  const t = await page.locator('main').innerText();
  return { ok: all.length === 9 && !all.includes('Mochila preta') && !all.includes('Carregador USB-C') && /Em reivindicação/.test(t), note: all.join(' | ') };
});
await check('AC03.4a', 'Ordenação: mais recentes (registro) primeiro', async () => {
  const exp = ['Fones de ouvido sem fio', 'Carteira de estudante', 'Chaveiro com três chaves', 'Calculadora científica', 'Casaco azul-marinho', 'Notebook cinza', 'Garrafa térmica verde', 'Guarda-chuva preto', 'Óculos de grau'];
  return { ok: JSON.stringify(all) === JSON.stringify(exp), note: all.join(' | ') };
});
await check('AC03.3a', 'Filtro Categoria=Eletrônicos (desktop, aplicação imediata): 3 itens; URL ganha ?categoria=', async () => {
  await filt('Categoria').selectOption('Eletrônicos'); await settle();
  const t = await titles();
  return { ok: t.length === 3 && page.url().includes('categoria=Eletr'), note: t.join(' | ') + ' :: ' + page.url() + ' :: contagem=' + await count() };
});
await check('AC03.3b', 'Categoria + Local combinados (Eletrônicos + Bloco A) = 1 item (Calculadora)', async () => {
  await filt('Local').selectOption('Bloco A'); await settle();
  const t = await titles();
  return { ok: t.length === 1 && t[0] === 'Calculadora científica', note: t.join(' | ') + ' :: ' + await count() };
});
await check('AC03.3c', 'Categoria + Local + período combinados (Eletrônicos+Biblioteca, de=hoje-6 até hoje-4) = Notebook', async () => {
  await filt('Local').selectOption('Biblioteca');
  await filt('Encontrado de').fill(dayStr(6)); await filt('Encontrado até').fill(dayStr(4)); await sleep(900); await settle();
  const t = await titles();
  return { ok: t.length === 1 && t[0] === 'Notebook cinza', note: t.join(' | ') + ' :: ' + page.url() };
});
const shareUrl = page.url();
await check('AC03.3d', 'Período sozinho inclusivo (de=hoje-4, até=hoje-2): Casaco, Calculadora, Chaveiro (3)', async () => {
  await page.goto(BASE + `/itens?de=${dayStr(4)}&ate=${dayStr(2)}`); await settle();
  const t = await titles();
  return { ok: t.length === 3, note: t.join(' | ') };
});
await check('AC03.5a', 'Sem resultados: estado vazio explicativo + "Limpar filtros" funciona', async () => {
  await page.goto(BASE + '/itens?categoria=Documentos&local=Bloco+A'); await settle();
  const t = await page.locator('main').innerText();
  const ok1 = /Nenhum item com esses filtros/.test(t);
  await page.screenshot({ path: OUT + '/search-sem-resultados-1280.png' });
  await page.locator('main').getByRole('button', { name: 'Limpar filtros' }).first().click(); await settle();
  const t2 = await titles();
  return { ok: ok1 && t2.length === 9 && !page.url().includes('categoria'), note: `após limpar: ${t2.length} itens; url=${page.url()}` };
});
await check('AC03.3e', 'URL compartilhável: abrir a URL filtrada em NOVA aba/contexto restaura os filtros e resultados', async () => {
  const c2 = await newCtx(b, { viewport: { width: 1280, height: 900 } }); const p2 = await newPage(c2);
  await demoLogin(p2, 'teacher');
  await p2.goto(shareUrl); await p2.waitForLoadState('networkidle'); await sleep(1500);
  const sel = await p2.locator('section[aria-label="Filtros da busca"] >> visible=true').getByLabel('Categoria', { exact: true }).inputValue();
  const loc = await p2.locator('section[aria-label="Filtros da busca"] >> visible=true').getByLabel('Local', { exact: true }).inputValue();
  const t = await p2.locator('main ul a[href^="/itens/"] h2, main ul a[href^="/itens/"] h3').allInnerTexts();
  await c2.close();
  return { ok: sel === 'Eletrônicos' && loc === 'Biblioteca' && t.length === 1, note: `cat=${sel} local=${loc} itens=${t}` };
});
await check('AC03.3f', 'Anônimo abrindo URL filtrada vai a /entrar (AC03.1)', async () => {
  const c3 = await newCtx(b); const p3 = await newPage(c3);
  await p3.goto(shareUrl); await p3.waitForLoadState('networkidle'); await sleep(1200);
  const u = new URL(p3.url()).pathname; await c3.close();
  return { ok: u === '/entrar', note: u };
});
await check('AC03.x-voltar', 'Voltar do navegador: filtrar → abrir item → voltar mantém filtros', async () => {
  await page.goto(BASE + '/itens'); await settle();
  await filt('Categoria').selectOption('Eletrônicos'); await settle();
  await page.locator('main ul a[href^="/itens/"]').first().click(); await page.waitForURL(/\/itens\/item-/); await settle();
  await page.goBack(); await settle();
  const sel = await filt('Categoria').inputValue(); const t = await titles();
  return { ok: sel === 'Eletrônicos' && t.length === 3 && page.url().includes('categoria='), note: page.url() };
});
await check('AC03.x-hist', 'Mudar filtro não empilha histórico (replace): voltar sai da busca', async () => {
  await page.goto(BASE + '/itens'); await settle();
  const h0 = await page.evaluate(() => history.length);
  await filt('Categoria').selectOption('Roupas'); await settle();
  await filt('Local').selectOption('Cantina'); await settle();
  const h1 = await page.evaluate(() => history.length);
  return { ok: h0 === h1, note: `history.length ${h0} -> ${h1}` };
});
await check('AC03.x-invalid', 'Parâmetros inválidos na URL (?categoria=XYZ&de=abc) são ignorados sem quebrar', async () => {
  await page.goto(BASE + '/itens?categoria=XYZ&de=abc&ate=2026-13-45&local=%3Cscript%3E'); await settle();
  const t = await titles();
  return { ok: t.length === 9, note: `${t.length} itens; console=${JSON.stringify(page.consoleMsgs.slice(-2))}` };
});
await check('AC03.x-periodo-invertido', 'Período invertido (de > até) é tratado (erro visível ou ignorado)', async () => {
  await page.goto(BASE + '/itens'); await settle();
  await filt('Encontrado de').fill(dayStr(1)); await filt('Encontrado até').fill(dayStr(5)); await sleep(900);
  const t = await page.locator('main').innerText();
  return { ok: /data final deve ser igual ou posterior/.test(t), note: (t.match(/A data final[^\n]*/) || ['(sem mensagem)'])[0] };
});
await check('AC03.2c', 'Filtro Outros/Eletrônicos nunca lista devolvidos (Mochila preta/Carregador)', async () => {
  await page.goto(BASE + '/itens?categoria=Outros'); await settle(); const a = await titles();
  await page.goto(BASE + '/itens?categoria=Eletr%C3%B4nicos'); await settle(); const e = await titles();
  return { ok: !a.includes('Mochila preta') && !e.includes('Carregador USB-C'), note: `Outros: ${a} | Eletrônicos: ${e}` };
});
await check('AC03.2d', 'Skeleton visível durante carregamento da lista (região "Carregando itens…")', async () => {
  await page.goto(BASE + '/itens', { waitUntil: 'commit' });
  let seen = false;
  for (let i = 0; i < 25 && !seen; i++) { seen = (await page.locator('[aria-busy=true]').count()) > 0 || (await page.getByText('Carregando itens…').count()) > 0; if (!seen) await sleep(60); }
  await settle();
  return { ok: seen };
});

// ---- Celular: sheet de filtros ----
const cm = await newCtx(b, { viewport: { width: 360, height: 780 }, hasTouch: true }); const pm = await newPage(cm);
await demoLogin(pm, 'student');
const mt = async () => pm.locator('main ul a[href^="/itens/"] h2, main ul a[href^="/itens/"] h3').allInnerTexts();
await pm.goto(BASE + '/itens'); await pm.waitForLoadState('networkidle'); await sleep(1300);
await check('AC03.3g-sheet', 'Mobile 360: botão "Filtros" abre sheet (dialog), foco entra no 1º campo, Aplicar filtra e mostra chips + "Filtros (2)"', async () => {
  const btn = pm.getByRole('button', { name: /^Filtros/ });
  await btn.click(); await sleep(500);
  const dlg = pm.getByRole('dialog');
  const open = await dlg.count();
  const foc = await pm.evaluate(() => { const a = document.activeElement; const l = a?.id && document.querySelector(`label[for="${a.id}"]`); return l ? l.textContent : a?.tagName; });
  await pm.screenshot({ path: OUT + '/search-sheet-360.png' });
  await dlg.getByLabel('Categoria').selectOption('Eletrônicos'); await dlg.getByLabel('Local').selectOption('Bloco A');
  await dlg.getByRole('button', { name: 'Aplicar' }).click(); await sleep(1500);
  const t = await mt(); const label = await pm.getByRole('button', { name: /^Filtros/ }).innerText();
  const chips = await pm.locator('ul[aria-label="Filtros ativos"] button').allInnerTexts();
  const focAfter = await pm.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
  await pm.screenshot({ path: OUT + '/search-chips-360.png' });
  return { ok: open === 1 && /Categoria/.test(foc) && t.length === 1 && /\(2\)/.test(label) && chips.length === 2, note: `foco inicial=${foc}; itens=${t}; botão="${label}"; chips=${chips}; foco após fechar="${focAfter}"` };
});
await check('AC03.3h-chip', 'Remover chip atualiza lista; "Limpar" no sheet zera', async () => {
  await pm.locator('ul[aria-label="Filtros ativos"] button').first().click(); await sleep(1300);
  const t = await mt();
  await pm.getByRole('button', { name: /^Filtros/ }).click(); await sleep(400);
  await pm.getByRole('dialog').getByRole('button', { name: 'Limpar' }).click(); await sleep(1300);
  const t2 = await mt();
  return { ok: t.length === 2 && t2.length === 9, note: `após remover categoria: ${t.length}; após limpar: ${t2.length}` };
});
await check('AC08.1-sheet-esc', 'Sheet: Esc fecha e devolve o foco ao botão Filtros', async () => {
  const btn = pm.getByRole('button', { name: /^Filtros/ });
  await btn.click(); await sleep(400);
  await pm.keyboard.press('Escape'); await sleep(400);
  const closed = await pm.getByRole('dialog').count();
  const foc = await pm.evaluate(() => document.activeElement?.textContent?.trim());
  return { ok: closed === 0 && /^Filtros/.test(foc), note: `foco="${foc}"` };
});
await check('AC03.3i-sheet-periodo-invalido', 'Sheet: período invertido mostra erro e Aplicar não fecha', async () => {
  await pm.getByRole('button', { name: /^Filtros/ }).click(); await sleep(400);
  const dlg = pm.getByRole('dialog');
  await dlg.getByLabel('Encontrado de').fill(dayStr(1)); await dlg.getByLabel('Encontrado até').fill(dayStr(5));
  await dlg.getByRole('button', { name: 'Aplicar' }).click(); await sleep(500);
  const still = await pm.getByRole('dialog').count(); const t = await dlg.innerText();
  await pm.keyboard.press('Escape');
  return { ok: still === 1 && /data final deve ser/.test(t), note: (t.match(/A data final[^\n]*/) || [''])[0] };
});
info('console', 'console', JSON.stringify({ d: page.consoleMsgs, m: pm.consoleMsgs }));
save();
await b.close();
