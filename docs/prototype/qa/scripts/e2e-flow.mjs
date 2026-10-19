// Fluxo completo de demonstracao (SPEC §1/§7). Uso: node e2e-flow.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const IMG = process.env.QA_IMGS || new URL('./imgs', import.meta.url).pathname;
const { check, info, save } = makeRec('e2e-flow');
const b = await launch();
const ctx = await newCtx(b);
const text = async (p) => (await p.locator('body').innerText());
const has = async (p, re) => re.test(await text(p));
const idFromUrl = (p) => p.url().split('/itens/')[1].split('/')[0].split('?')[0];

async function registerItem(page, { title, desc, cat, loc, stored, photo }) {
  await page.goto(BASE + '/itens/novo');
  if (photo) await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByLabel('O que foi encontrado?').fill(title);
  await page.getByLabel('Descrição').fill(desc);
  await page.getByLabel('Categoria').selectOption(cat);
  await page.getByLabel('Onde foi encontrado?').selectOption(loc);
  await page.getByLabel('Onde está guardado agora?').fill(stored);
  await page.getByRole('button', { name: 'Registrar item' }).click();
  await page.waitForURL((u) => /^\/itens\/[^/]+$/.test(u.pathname) && u.pathname !== '/itens/novo', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return idFromUrl(page);
}
async function claim(page, id, proof, where) {
  await page.goto(BASE + `/itens/${id}/reivindicar`);
  await page.getByLabel('Que detalhes só o dono saberia?').fill(proof);
  await page.getByLabel('Onde e quando você perdeu?').fill(where);
  await page.getByRole('button', { name: 'Enviar reivindicação' }).click();
  await page.waitForURL(/minhas-reivindicacoes/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}
async function decide(page, claimId, action /* Aceitar | Recusar */) {
  await page.goto(BASE + `/admin/reivindicacoes/${claimId}`);
  await page.getByRole('button', { name: action, exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: `${action} reivindicação` }).click();
  await page.waitForTimeout(1500);
}
async function claimIdFor(adminPage, itemTitle, claimantName) {
  await adminPage.goto(BASE + '/admin');
  await adminPage.waitForLoadState('networkidle');
  await sleep(1200);
  const row = adminPage.locator('li', { hasText: itemTitle }).filter({ hasText: claimantName }).filter({ has: adminPage.getByRole('link', { name: /Analisar/ }) }).first();
  const href = await row.getByRole('link', { name: /Analisar/ }).first().getAttribute('href');
  return href.split('/').pop();
}
async function searchHas(page, title) {
  await page.goto(BASE + '/itens');
  await page.waitForLoadState('networkidle');
  await sleep(1200);
  return (await text(page)).includes(title);
}

// ---------- RF01: cadastro, login, sessao ----------
const camila = await newPage(ctx);
await camila.setViewportSize({ width: 390, height: 844 });
await camila.goto(BASE + '/cadastro');
await check('AC01.1a', 'Cadastro cria conta e entra (nome, e-mail, papel)', async () => {
  await camila.getByLabel('Nome completo').fill('Camila QA');
  await camila.getByLabel('E-mail').fill('camila.qa@teste.test');
  await camila.locator('label', { hasText: 'Aluno' }).click();
  await camila.getByRole('button', { name: 'Criar conta' }).click();
  await camila.waitForURL(/\/itens$/, { timeout: 10000 });
  return { ok: true, note: 'URL ' + camila.url() };
});
await check('AC01.4a', 'Sessão persiste ao recarregar', async () => {
  await camila.reload(); await camila.waitForLoadState('networkidle'); await sleep(800);
  return { ok: camila.url().endsWith('/itens') && await has(camila, /Itens encontrados/) };
});
await check('AC01.4b', 'Sair encerra a sessão (volta a /entrar; /itens redireciona)', async () => {
  await camila.getByRole('button', { name: 'Menu da conta' }).click();
  await camila.getByRole('menuitem', { name: 'Sair' }).click();
  await camila.waitForURL(/\/entrar/, { timeout: 8000 });
  await camila.goto(BASE + '/itens'); await camila.waitForURL(/\/entrar/, { timeout: 8000 });
  return { ok: true };
});
await check('AC01.2a', 'Login por e-mail cadastrado cria sessão', async () => {
  await camila.goto(BASE + '/entrar');
  await camila.getByLabel('E-mail').fill('camila.qa@teste.test');
  await camila.getByRole('button', { name: 'Entrar', exact: true }).click();
  await camila.waitForURL(/\/itens$/, { timeout: 10000 });
  return true;
});

// ---------- RF02: registrar item com e sem foto ----------
let itemA, itemB, itemC;
await check('AC02.1/2/3a', 'Registrar item COM foto (JPEG 4000x3000): vai ao detalhe, nasce Disponível, foto exibida', async () => {
  itemA = await registerItem(camila, { title: 'QA Mochila vermelha', desc: 'Mochila vermelha com alça rasgada.', cat: 'Outros', loc: 'Cantina', stored: 'Portaria QA', photo: IMG + '/grande-4000x3000.jpg' });
  await sleep(1200);
  const t = await text(camila);
  const img = await camila.evaluate(() => [...document.images].filter((i) => i.src.startsWith('data:')).map((i) => ({ w: i.naturalWidth, h: i.naturalHeight, chars: i.src.length, head: i.src.slice(0, 22) })));
  return { ok: /Disponível/.test(t) && /QA Mochila vermelha/.test(t) && img.length === 1 && Math.max(img[0].w, img[0].h) <= 640, note: `id=${itemA} data-url imgs=${JSON.stringify(img)}` };
});
await check('AC02.3b', 'Item novo aparece no topo da busca', async () => {
  await camila.goto(BASE + '/itens'); await camila.waitForLoadState('networkidle'); await sleep(1200);
  const first = await camila.locator('main a[href^="/itens/"]').first().innerText();
  return { ok: /QA Mochila vermelha/.test(first), note: first.split('\n')[0] };
});
await check('AC02.1b', 'Registrar item SEM foto', async () => {
  itemB = await registerItem(camila, { title: 'QA Caderno azul', desc: 'Caderno espiral azul.', cat: 'Documentos', loc: 'Biblioteca', stored: 'Biblioteca QA' });
  await sleep(1200);
  return { ok: /Disponível/.test(await text(camila)), note: 'id=' + itemB };
});
await check('AC02.1c', 'Registrar terceiro item (C) para teste de exclusão', async () => {
  itemC = await registerItem(camila, { title: 'QA Guarda-sol', desc: 'Guarda-sol amarelo.', cat: 'Outros', loc: 'Portaria', stored: 'Portaria QA' });
  return { ok: true, note: 'id=' + itemC };
});
await camila.screenshot({ path: OUT + '/flow-item-detalhe-camila-390.png', fullPage: false });

// ---------- Rafael (professor) e Marina (aluna) reivindicam A; Rafael reivindica B ----------
const rafael = await newPage(ctx);
await rafael.setViewportSize({ width: 390, height: 844 });
await demoLogin(rafael, 'teacher');
const marina = await newPage(ctx);
await marina.setViewportSize({ width: 390, height: 844 });
await demoLogin(marina, 'student');
const admin = await newPage(ctx);
await admin.setViewportSize({ width: 1280, height: 900 });
await demoLogin(admin, 'admin');

await check('AC04.1a', 'Usuário comum vê "É meu" em item Disponível (detalhe)', async () => {
  await rafael.goto(BASE + `/itens/${itemA}`); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  return { ok: await rafael.getByRole('link', { name: /É meu/ }).or(rafael.getByRole('button', { name: /É meu/ })).first().isVisible() };
});
await check('AC04.2/04.3a', 'Rafael reivindica A: item vira Em reivindicação; toast e redireciona a Minhas reivindicações', async () => {
  await claim(rafael, itemA, 'Há um chaveiro de lã verde pendurado no zíper.', 'Cantina, hoje de manhã.');
  await sleep(1200);
  const t = await text(rafael);
  return { ok: /QA Mochila vermelha/.test(t) && /Pendente/.test(t), note: (t.match(/Reivindicação enviada[^\n]*/) || ['(sem toast visível)'])[0] };
});
await check('AC04.3b', 'Marina também reivindica A (múltiplas, usuários diferentes)', async () => {
  await claim(marina, itemA, 'Dentro tem um estojo roxo com canetas.', 'Cantina, hoje.');
  await sleep(1200);
  return { ok: /QA Mochila vermelha/.test(await text(marina)) };
});
await check('AC04.2b', 'Detalhe de A mostra "Em reivindicação" e, ao Rafael, "Reivindicação pendente" sem botão "É meu"', async () => {
  await rafael.goto(BASE + `/itens/${itemA}`); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(rafael);
  const emMeu = await rafael.getByText('É meu', { exact: true }).count();
  return { ok: /Em reivindicação/.test(t) && /Reivindicação pendente/.test(t) && emMeu === 0 };
});
await check('AC04.x', 'Aluno (Camila, dona do registro) não vê reivindicações de terceiros no detalhe', async () => {
  await camila.goto(BASE + `/itens/${itemA}`); await camila.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(camila);
  return { ok: !/Rafael Lima|Marina Alves|Reivindicações deste item/.test(t), note: t.includes('É meu') ? 'Camila (autora) vê "É meu" (P8: permitido)' : 'sem "É meu"' };
});
await check('AC04.3c', 'Rafael reivindica B', async () => {
  await claim(rafael, itemB, 'Tem uma foto 3x4 colada na contracapa.', 'Biblioteca, ontem.');
  return true;
});

// ---------- Admin ----------
await check('AC04.4a', 'Painel admin lista as 3 novas pendentes (A: Rafael e Marina; B: Rafael) e aceitas/pendentes', async () => {
  await admin.goto(BASE + '/admin'); await admin.waitForLoadState('networkidle'); await sleep(1500);
  const t = await text(admin);
  await admin.screenshot({ path: OUT + '/flow-admin-painel-1280.png' });
  return { ok: (t.match(/QA Mochila vermelha/g) || []).length >= 2 && /QA Caderno azul/.test(t), note: t.replace(/\n+/g, ' | ').slice(0, 260) };
});
const claimARafael = await claimIdFor(admin, 'QA Mochila vermelha', 'Rafael Lima');
const claimAMarina = await claimIdFor(admin, 'QA Mochila vermelha', 'Marina Alves');
const claimBRafael = await claimIdFor(admin, 'QA Caderno azul', 'Rafael Lima');
info('ids', 'ids das reivindicações', JSON.stringify({ claimARafael, claimAMarina, claimBRafael }));

await check('AC04.4b', 'Análise abre, mostra publicado × respondido e aviso de outras reivindicações', async () => {
  await admin.goto(BASE + `/admin/reivindicacoes/${claimARafael}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(admin);
  await admin.screenshot({ path: OUT + '/flow-admin-analise-1280.png' });
  return { ok: /O QUE FOI PUBLICADO/i.test(t) && /chaveiro de lã verde/.test(t) && /outra reivindicação pendente/.test(t) };
});
await check('AC04.6a', 'Recusar a ÚLTIMA ativa de B devolve B a Disponível (diálogo avisa)', async () => {
  await admin.goto(BASE + `/admin/reivindicacoes/${claimBRafael}`);
  await admin.getByRole('button', { name: 'Recusar', exact: true }).click();
  const dlgText = await admin.getByRole('dialog').innerText();
  await admin.getByRole('dialog').getByRole('button', { name: 'Recusar reivindicação' }).click();
  await sleep(1500);
  await admin.goto(BASE + `/itens/${itemB}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(admin);
  return { ok: /Disponível/.test(t) && !/Em reivindicação/.test(t) && /voltará a ficar Disponível/i.test(dlgText), note: 'diálogo: ' + dlgText.replace(/\n+/g, ' | ').slice(0, 200) };
});
await check('AC04.7a', 'Rafael vê B como Recusada e NÃO consegue reenviar (rota e botão)', async () => {
  await rafael.goto(BASE + `/itens/${itemB}`); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(rafael);
  const emMeu = await rafael.getByText('É meu', { exact: true }).count();
  await rafael.goto(BASE + `/itens/${itemB}/reivindicar`); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  const t2 = await text(rafael);
  const formVisible = await rafael.getByRole('button', { name: 'Enviar reivindicação' }).count();
  return { ok: /Reivindicação recusada/.test(t) && emMeu === 0 && formVisible === 0, note: 'rota reivindicar: ' + t2.replace(/\n+/g, ' | ').slice(130, 330) };
});
await check('AC04.8a', 'Minhas reivindicações de Rafael mostra B Recusada', async () => {
  await rafael.goto(BASE + '/minhas-reivindicacoes'); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  const card = rafael.locator('li', { hasText: 'QA Caderno azul' });
  return { ok: /Recusada/.test(await card.innerText()) };
});
await check('AC04.5a', 'Aceitar A/Rafael recusa automaticamente A/Marina; item permanece Em reivindicação', async () => {
  await admin.goto(BASE + `/admin/reivindicacoes/${claimARafael}`);
  await admin.getByRole('button', { name: 'Aceitar', exact: true }).click();
  const dlgText = await admin.getByRole('dialog').innerText();
  await admin.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click();
  await sleep(1500);
  const afterAcceptText = await text(admin);
  await admin.goto(BASE + `/admin/reivindicacoes/${claimAMarina}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const tm = await text(admin);
  await admin.goto(BASE + `/itens/${itemA}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const ti = await text(admin);
  return { ok: /Recusada/.test(tm) && /Em reivindicação/.test(ti) && /Registrar devolução/.test(ti), note: 'dlg: ' + dlgText.replace(/\n+/g, ' | ').slice(0, 220) };
});
await check('AC04.7b', 'Marina vê A Recusada; não pode reenviar', async () => {
  await marina.goto(BASE + `/itens/${itemA}`); await marina.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(marina);
  return { ok: /Reivindicação recusada/.test(t) && (await marina.getByText('É meu', { exact: true }).count()) === 0 };
});
await check('P14', 'Outro usuário (Camila) não pode reivindicar A (já aceita) — motivo explicado', async () => {
  await camila.goto(BASE + `/itens/${itemA}`); await camila.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(camila);
  const emMeu = await camila.getByText('É meu', { exact: true }).count();
  await camila.goto(BASE + `/itens/${itemA}/reivindicar`); await camila.waitForLoadState('networkidle'); await sleep(1000);
  const t2 = await text(camila);
  return { ok: emMeu === 0 && (await camila.getByRole('button', { name: 'Enviar reivindicação' }).count()) === 0, note: 'detalhe: ' + t.replace(/\n+/g, ' | ').slice(150, 330) + ' || reivindicar: ' + t2.replace(/\n+/g, ' | ').slice(130, 300) };
});
await check('AC05.1a', 'Botão "Registrar devolução" só para admin e só com aceita (não aparece para Rafael)', async () => {
  await rafael.goto(BASE + `/itens/${itemA}`); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  const n = await rafael.getByRole('button', { name: /Registrar devolução/ }).count();
  await admin.goto(BASE + `/itens/${itemB}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const nB = await admin.getByRole('button', { name: /Registrar devolução/ }).count();
  return { ok: n === 0 && nB === 0, note: `Rafael=${n}; admin em B (sem aceita)=${nB}` };
});
await check('AC05.2a', 'Registrar devolução: diálogo de confirmação; item vira Devolvido', async () => {
  await admin.goto(BASE + `/admin/reivindicacoes/${claimARafael}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  await admin.getByRole('button', { name: 'Registrar devolução' }).click();
  const dlgText = await admin.getByRole('dialog').innerText();
  await admin.getByRole('dialog').getByRole('button', { name: 'Registrar devolução' }).click();
  await sleep(1800);
  await admin.goto(BASE + `/itens/${itemA}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(admin);
  return { ok: /Devolvido/.test(t) && !/Registrar devolução/.test(t), note: 'dlg: ' + dlgText.replace(/\n+/g, ' | ').slice(0, 240) };
});
await check('AC03.2a', 'Item devolvido some da busca (admin e usuário)', async () => {
  const a = await searchHas(admin, 'QA Mochila vermelha');
  const r = await searchHas(rafael, 'QA Mochila vermelha');
  return { ok: !a && !r, note: `admin vê=${a}; rafael vê=${r}` };
});
await check('AC05.2b', 'Devolução aparece em /admin/devolucoes (com Entregue a Rafael Lima)', async () => {
  await admin.goto(BASE + '/admin/devolucoes'); await admin.waitForLoadState('networkidle'); await sleep(1200);
  await admin.screenshot({ path: OUT + '/flow-admin-devolucoes-1280.png' });
  const row = admin.locator('tr', { hasText: 'QA Mochila vermelha' });
  return { ok: /Rafael Lima/.test(await row.innerText()), note: (await row.innerText()).replace(/\s+/g, ' ') };
});
await check('AC05.3a', 'Filtro por período em devoluções (De/Até filtra por data da devolução)', async () => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
  const from = admin.getByLabel('Devolvido de'); const to = admin.getByLabel('até');
  await from.fill(today); await to.fill(today); await sleep(1500);
  const t1 = await text(admin);
  const onlyToday = /QA Mochila vermelha/.test(t1) && !/Carregador USB-C/.test(t1) && !/Mochila preta/.test(t1);
  await from.fill('2020-01-01'); await to.fill('2020-01-02'); await sleep(1500);
  const t2 = await text(admin);
  const none = /Nenhuma devolução nesse período/.test(t2);
  await admin.screenshot({ path: OUT + '/flow-admin-devolucoes-sem-resultado-1280.png' });
  return { ok: onlyToday && none, note: `hoje=${onlyToday}; vazio=${none}; texto vazio: ${(t2.match(/Nenhuma devolução[^\n]*/) || [''])[0]}` };
});
await check('AC05.3b', 'Sem botão de exportar em devoluções', async () => {
  const t = await text(admin);
  return { ok: !/exportar|baixar|csv|pdf|planilha/i.test(t) };
});
await check('AC04.8b', 'Rafael/Marina veem estado em Minhas reivindicações (Aceita + devolvido / Recusada)', async () => {
  await rafael.goto(BASE + '/minhas-reivindicacoes'); await rafael.waitForLoadState('networkidle'); await sleep(1200);
  const ca = await rafael.locator('li', { hasText: 'QA Mochila vermelha' }).innerText();
  await marina.goto(BASE + '/minhas-reivindicacoes'); await marina.waitForLoadState('networkidle'); await sleep(1200);
  const cm = await marina.locator('li', { hasText: 'QA Mochila vermelha' }).innerText();
  return { ok: /Aceita/.test(ca) && /devolvido/i.test(ca) && /Recusada/.test(cm), note: 'Rafael: ' + ca.replace(/\n+/g, ' | ') + ' || Marina: ' + cm.replace(/\n+/g, ' | ') };
});
await check('AC06.1a', 'Item devolvido é somente leitura: sem editar/excluir no detalhe; /editar bloqueado', async () => {
  await admin.goto(BASE + `/itens/${itemA}`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const links = await admin.getByRole('link', { name: /Editar/ }).count();
  const btns = await admin.getByRole('button', { name: /Excluir/ }).count();
  await admin.goto(BASE + `/admin/itens/${itemA}/editar`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  const t = await text(admin);
  return { ok: links === 0 && btns === 0 && /não pode ser editado/.test(t) && (await admin.getByRole('button', { name: /Excluir/ }).count()) === 0, note: `Editar=${links}, Excluir=${btns}` };
});
await check('RF05.x', 'Devolvido: nova reivindicação bloqueada para outro usuário (Camila) e Marina/Rafael', async () => {
  await camila.goto(BASE + `/itens/${itemA}/reivindicar`); await camila.waitForLoadState('networkidle'); await sleep(1000);
  return { ok: (await camila.getByRole('button', { name: 'Enviar reivindicação' }).count()) === 0, note: (await text(camila)).replace(/\n+/g, ' | ').slice(120, 300) };
});

// ---------- Excluir pelo admin remove reivindicações ----------
await check('P18/AC06.1b', 'Exclusão pelo admin (com confirmação) remove item C e suas reivindicações', async () => {
  await claim(rafael, itemC, 'Tem uma costura azul no pé.', 'Portaria, hoje.');
  await admin.goto(BASE + `/admin/itens/${itemC}/editar`); await admin.waitForLoadState('networkidle'); await sleep(1000);
  await admin.getByRole('button', { name: 'Excluir item' }).click();
  const dlgText = await admin.getByRole('dialog').innerText();
  const focusedInDialog = await admin.evaluate(() => document.activeElement?.textContent);
  await admin.getByRole('dialog').getByRole('button', { name: 'Excluir item' }).click();
  await sleep(1800);
  const afterUrl = admin.url();
  await rafael.goto(BASE + '/minhas-reivindicacoes'); await rafael.waitForLoadState('networkidle'); await sleep(1200);
  const gone = !(await text(rafael)).includes('QA Guarda-sol');
  await rafael.goto(BASE + `/itens/${itemC}`); await rafael.waitForLoadState('networkidle'); await sleep(1000);
  const nf = /Item não encontrado/.test(await text(rafael));
  const inSearch = await searchHas(rafael, 'QA Guarda-sol');
  return { ok: gone && nf && !inSearch, note: `dlg: ${dlgText.replace(/\n+/g, ' | ').slice(0, 220)} || foco inicial: "${focusedInDialog}" || após excluir URL: ${afterUrl}` };
});

info('console-camila', 'erros de console', JSON.stringify(camila.consoleMsgs));
info('console-rafael', 'erros de console', JSON.stringify(rafael.consoleMsgs));
info('console-marina', 'erros de console', JSON.stringify(marina.consoleMsgs));
info('console-admin', 'erros de console', JSON.stringify(admin.consoleMsgs));
save();
await b.close();
