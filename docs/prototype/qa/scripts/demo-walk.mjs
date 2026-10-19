import { launch, newCtx, newPage, BASE, sleep } from './lib.mjs';

const W = Number(process.env.W || 390);
const H = W >= 1000 ? 900 : 844;
const log = (k, v) => console.log(`[${W}px] ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
const clip = (s, n = 260) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const mainText = async (p, n = 300) => clip(await p.locator('main').first().innerText().catch(() => ''), n);
const settle = async (p) => { await p.waitForLoadState('networkidle').catch(() => {}); await sleep(900); };
const toasts = async (p) => clip(await p.locator('[role="status"],[role="alert"]').allInnerTexts().then((a) => a.filter(Boolean).join(' || ')).catch(() => ''), 240);

const browser = await launch();
const ctx = await newCtx(browser, { viewport: { width: W, height: H } });
const A = await newPage(ctx);
const B = await newPage(ctx);
const issues = [];

// ---------- 0. Entrada e reinício ----------
await A.goto(BASE + '/entrar'); await settle(A);
log('0 /entrar botões', await A.getByRole('button').allInnerTexts().then((a) => a.map((s) => clip(s, 50))));
const resetBtn = A.getByRole('button', { name: /Reiniciar demonstração/ });
log('0 reset visível em /entrar', await resetBtn.count());
if (await resetBtn.count()) {
  await resetBtn.first().click(); await sleep(400);
  log('0 reset diálogo', clip(await A.getByRole('dialog').innerText().catch(() => '')));
  await A.getByRole('dialog').getByRole('button', { name: 'Reiniciar' }).click().catch((e) => issues.push('reset confirm: ' + e.message));
  await sleep(1500); log('0 reset toast', await toasts(A));
}

// ---------- 1. Aluna: lista e filtros ----------
await A.goto(BASE + '/entrar'); await settle(A);
await A.getByRole('button', { name: /Aluno demo/ }).click(); await A.waitForURL((u) => !u.pathname.startsWith('/entrar')); await settle(A);
log('1 após login aluno URL', new URL(A.url()).pathname + new URL(A.url()).search);
log('1 cabeçalho/h1', clip(await A.locator('h1').first().innerText()));
log('1 cartões na lista', await A.locator('a[href^="/itens/item-"]').count());
// filtros
if (W < 1000) {
  const fb = A.getByRole('button', { name: /Filtros/ });
  log('1 botão Filtros (celular)', await fb.count() ? clip(await fb.first().innerText(), 40) : 'AUSENTE');
  if (await fb.count()) { await fb.first().click(); await sleep(400); log('1 folha filtros', clip(await A.getByRole('dialog').innerText().catch(() => ''), 220)); await A.keyboard.press('Escape'); await sleep(300); }
} else {
  log('1 campos de filtro (desktop)', await A.getByRole('combobox').allInnerTexts().then((a) => a.map((s) => clip(s, 40))).catch(() => []));
}

// ---------- 2. Aluna: registrar item ----------
await A.goto(BASE + '/itens/novo'); await settle(A);
await A.getByRole('button', { name: 'Registrar item' }).first().click(); await sleep(600);
log('2 envio vazio: erros', await A.locator('[id$="-error"],[role="alert"]').allInnerTexts().then((a) => a.map((s) => clip(s, 70)).filter(Boolean)).catch(() => []));
log('2 foco após erro', await A.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
const TITLE = 'Garrafa térmica azul (roteiro)';
await A.getByLabel('O que foi encontrado?').fill(TITLE);
await A.getByLabel('Descrição').fill('Garrafa térmica azul com adesivo na tampa, encontrada perto da entrada.');
const cat = A.getByLabel('Categoria'); const loc = A.getByLabel('Onde foi encontrado?');
await cat.selectOption({ index: 1 }).catch(() => {}); await loc.selectOption({ index: 1 }).catch(() => {});
await A.getByLabel('Onde está guardado agora?').fill('Portaria (demonstrativo)');
await A.getByRole('button', { name: 'Registrar item' }).first().click();
await A.waitForURL(/\/itens\/item-/, { timeout: 15000 }).catch(() => issues.push('registro: não abriu o detalhe'));
await settle(A);
const newPath = new URL(A.url()).pathname;
log('2 após salvar URL', newPath);
log('2 toast', await toasts(A));
log('2 detalhe (h1 / selo / texto)', { h1: clip(await A.locator('h1').first().innerText(), 60), main: await mainText(A, 360) });

// ---------- 3. Sair; Professor reivindica ----------
await A.getByRole('button', { name: 'Menu da conta' }).click(); await sleep(300);
log('3 itens do menu da conta', await A.getByRole('menuitem').allInnerTexts().then((a) => a.map((s) => clip(s, 40))));
await A.getByRole('menuitem', { name: 'Sair' }).click(); await A.waitForURL(/\/entrar/).catch(() => {}); await settle(A);
await A.getByRole('button', { name: /Professor demo/ }).click(); await A.waitForURL((u) => !u.pathname.startsWith('/entrar')); await settle(A);
await A.goto(BASE + newPath); await settle(A);
const emMeu = A.getByRole('button', { name: /É meu/ }).or(A.getByRole('link', { name: /É meu/ }));
log('3 "É meu" presente', await emMeu.count());
await emMeu.first().click(); await A.waitForURL(/reivindicar/).catch(() => issues.push('É meu não abriu /reivindicar')); await settle(A);
log('3 form reivindicação', { h1: clip(await A.locator('h1').first().innerText(), 60), campos: await A.locator('label').allInnerTexts().then((a) => a.map((s) => clip(s, 60))) });
await A.getByLabel('Que detalhes só o dono saberia?').fill('Adesivo de uma coruja na tampa e um arranhão no fundo.');
await A.getByLabel('Onde e quando você perdeu?').fill('Perdi na segunda-feira de manhã, perto da entrada.');
await A.getByRole('button', { name: 'Enviar reivindicação' }).click();
await sleep(1500); await settle(A);
log('3 após enviar URL', new URL(A.url()).pathname);
log('3 toast', await toasts(A));
log('3 tela após enviar', await mainText(A, 360));
await A.goto(BASE + '/minhas-reivindicacoes'); await settle(A);
log('3 Minhas reivindicações (1º cartão)', await mainText(A, 420));

await A.goto(BASE + newPath); await settle(A);
log('3 item logo após reivindicar (Professor)', await mainText(A, 300));
// ---------- 4. Admin (aba B) ----------
await B.goto(BASE + '/entrar'); await settle(B);
await B.getByRole('button', { name: /Administração demo/ }).click(); await B.waitForURL((u) => !u.pathname.startsWith('/entrar')); await settle(B);
log('4 após login admin URL', new URL(B.url()).pathname);
for (let i=0;i<20 && /Carregando/.test(await mainText(B,400));i++) await sleep(400);
log('4 painel (texto)', await mainText(B, 520));
const dashLinks = await B.locator('main a').allInnerTexts().then((a) => a.map((s) => clip(s, 70)));
log('4 links do painel', dashLinks.slice(0, 14));
// localizar a reivindicação do item novo pelo painel
const row = B.locator('main a', { hasText: 'Garrafa térmica' }).first();
log('4 item novo aparece no painel', await row.count());
if (await row.count()) { await row.click(); } else { await B.goto(BASE + newPath); await settle(B); }
await settle(B);
log('4 após clicar no item (URL)', new URL(B.url()).pathname);
const analisar = B.getByRole('link', { name: /Analisar|Ver análise|reivindicação/i });
if (!/reivindicacoes\//.test(B.url())) {
  log('4 links na tela do item', await B.locator('main a').allInnerTexts().then((a) => a.map((s) => clip(s, 60))));
  if (await analisar.count()) { await analisar.first().click(); await settle(B); }
}
log('4 análise URL', new URL(B.url()).pathname);
log('4 análise texto', await mainText(B, 520));
log('4 botões', await B.getByRole('button').allInnerTexts().then((a) => a.map((s) => clip(s, 40))));
await B.getByRole('button', { name: 'Aceitar', exact: true }).click(); await sleep(500);
log('4 diálogo aceitar', clip(await B.getByRole('dialog').innerText()));
await B.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click(); await sleep(1500);
log('4 toast aceitar', await toasts(B));
log('4 após aceitar (texto)', await mainText(B, 420));
log('4 botões após aceitar', await B.getByRole('button').allInnerTexts().then((a) => a.map((s) => clip(s, 40))));

// ---------- 5. Devolução ----------
await B.getByRole('button', { name: 'Registrar devolução' }).first().click(); await sleep(500);
log('5 diálogo devolução', clip(await B.getByRole('dialog').innerText()));
await B.getByRole('dialog').getByRole('button', { name: 'Registrar devolução' }).click();
await B.waitForURL(/devolucoes|\/admin$/, { timeout: 15000 }).catch(() => issues.push('devolução: sem redirecionamento'));
await settle(B);
log('5 após devolução URL', new URL(B.url()).pathname);
log('5 toast', await toasts(B));
log('5 devoluções (texto)', await mainText(B, 520));
log('5 item novo na lista de devoluções', await B.getByText('Garrafa térmica', { exact: false }).count());
log('5 campos de filtro de período', await B.locator('label').allInnerTexts().then((a) => a.map((s) => clip(s, 40))));

// ---------- 6. Professor vê o resultado; item sai da busca ----------
await sleep(800);
log('6 (aba A) Minhas reivindicações SEM recarregar', await mainText(A, 420));
await A.reload(); await settle(A);
log('6 (aba A) após recarregar', await mainText(A, 420));
await A.goto(BASE + '/itens'); await settle(A);
for (let i=0;i<20 && /Carregando|skeleton/i.test(await mainText(A,200));i++) await sleep(300);
log('6 títulos na busca', await A.locator('a[href^="/itens/item-"]').evaluateAll((els)=>els.map(e=>e.getAttribute('href')+' :: '+e.innerText.replace(/\s+/g,' ').slice(0,60))));
log('6 item novo ainda na busca?', await A.locator('a[href="'+newPath+'"]').count());
await A.goto(BASE + newPath); await settle(A);
log('6 detalhe do item devolvido', await mainText(A, 420));
log('6 botões/links de ação no detalhe devolvido', await A.getByRole('button').allInnerTexts().then((a) => a.map((s) => clip(s, 40))));

log('PROBLEMAS', issues);
log('console A', page_msgs(A)); log('console B', page_msgs(B));
function page_msgs(p) { return p.consoleMsgs.map((s) => clip(s, 120)); }
await browser.close();
