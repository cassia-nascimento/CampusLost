// Formularios: validacao, foco, aria, duplo envio, perda de dados. Uso: node forms.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const IMG = (process.env.QA_IMGS || new URL('./imgs', import.meta.url).pathname);
const { check, info, save } = makeRec('forms');
const b = await launch();
const ctx = await newCtx(b);
const page = await newPage(ctx);
const text = async () => (await page.locator('body').innerText());
const DB = "campuslost:proto:v1:db";
const db = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), DB);
const active = () => page.evaluate(() => { const a = document.activeElement; if (!a) return null; const lab = a.id && document.querySelector(`label[for="${CSS.escape(a.id)}"]`); return { tag: a.tagName, id: a.id, label: lab ? lab.textContent.trim() : (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) }; });
async function a11y(label, exact = true) {
  const el = page.getByLabel(label, { exact }).first();
  return el.evaluate((e) => {
    const ids = (e.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    const described = ids.map((i) => { const n = document.getElementById(i); return n ? n.textContent.trim() : '(ID INEXISTENTE ' + i + ')'; });
    const errId = ids.find((i) => i.endsWith('-error'));
    const live = errId ? document.getElementById(errId)?.getAttribute('aria-live') : null;
    return { invalid: e.getAttribute('aria-invalid'), described, live };
  });
}
const ctl = async (label) => page.getByLabel(label, { exact: true }).first();

// ============ LOGIN ============
await page.goto(BASE + '/entrar'); await page.waitForLoadState('networkidle');
await check('AC08.1-login-vazio', 'Login: enviar vazio mostra erro, foco no campo, aria-invalid/aria-describedby, região live', async () => {
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await sleep(400);
  const s = await a11y('E-mail'); const f = await active();
  return { ok: s.invalid === 'true' && s.described.some((d) => /Informe seu e-mail/.test(d)) && s.live === 'polite' && f.label === 'E-mail', note: JSON.stringify({ s, f, sr: await page.locator('[role=status].sr-only').allInnerTexts() }) };
});
await check('AC08.1-login-formato', 'Login: e-mail inválido (nome@) mostra erro de formato', async () => {
  await (await ctl('E-mail')).fill('nome@'); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await sleep(400);
  const s = await a11y('E-mail');
  return { ok: s.described.some((d) => /não parece válido/.test(d)), note: JSON.stringify(s.described) };
});
await check('AC01.2b', 'Login: e-mail inexistente mostra erro claro e mantém o texto', async () => {
  await (await ctl('E-mail')).fill('ninguem@demo.test'); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await sleep(1200);
  const s = await a11y('E-mail'); const v = await (await ctl('E-mail')).inputValue();
  return { ok: s.described.some((d) => /Não encontramos esse e-mail/.test(d)) && v === 'ninguem@demo.test', note: JSON.stringify(s.described) };
});
await check('AC01.2c', 'Login: e-mail com maiúsculas/espaços (" MARINA@Demo.test ") entra', async () => {
  await (await ctl('E-mail')).fill('  MARINA@Demo.test  '); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/\/itens/, { timeout: 8000 });
  return true;
});

// ============ CADASTRO ============
const ctx2 = await newCtx(b); const p2 = await newPage(ctx2);
const pg = p2;
await pg.goto(BASE + '/cadastro'); await pg.waitForLoadState('networkidle');
const a11yp = (label) => pg.getByLabel(label, { exact: true }).first().evaluate((e) => { const ids = (e.getAttribute('aria-describedby') || '').split(' ').filter(Boolean); return { invalid: e.getAttribute('aria-invalid'), described: ids.map((i) => document.getElementById(i)?.textContent.trim() ?? '(ID INEXISTENTE)'), live: document.getElementById(ids.find((i) => i.endsWith('-error')) || '')?.getAttribute('aria-live') }; });
await check('AC01.1b', 'Cadastro: submit vazio → erros nos 3 campos, foco no primeiro inválido, anúncio "Corrija 3 campos"', async () => {
  await pg.getByRole('button', { name: 'Criar conta' }).click(); await sleep(500);
  const n = await a11yp('Nome completo'); const e = await a11yp('E-mail');
  const grp = await pg.locator('fieldset[role=radiogroup]').evaluate((g) => ({ invalid: g.getAttribute('aria-invalid'), desc: (g.getAttribute('aria-describedby') || '').split(' ').map((i) => document.getElementById(i)?.textContent.trim()) }));
  const f = await pg.evaluate(() => document.activeElement?.id && document.querySelector(`label[for="${document.activeElement.id}"]`)?.textContent.trim());
  const sr = (await pg.locator('[role=status].sr-only').allInnerTexts()).join('|');
  return { ok: n.invalid === 'true' && e.invalid === 'true' && f === 'Nome completo' && /Corrija 3 campos/.test(sr) && grp.invalid === 'true', note: JSON.stringify({ n: n.described, e: e.described, grp, f, sr }) };
});
await check('AC01.1c', 'Cadastro: nome só com espaços e 1 caractere rejeitados', async () => {
  await pg.getByLabel('Nome completo').fill('   '); await pg.getByLabel('E-mail').fill('x@y.test'); await pg.locator('label', { hasText: 'Professor' }).click();
  await pg.getByRole('button', { name: 'Criar conta' }).click(); await sleep(400);
  const n1 = await a11yp('Nome completo');
  await pg.getByLabel('Nome completo').fill('A'); await pg.getByRole('button', { name: 'Criar conta' }).click(); await sleep(400);
  const n2 = await a11yp('Nome completo');
  return { ok: n1.described.length > 0 && n2.described.some((d) => /pelo menos 2/.test(d)), note: JSON.stringify({ n1: n1.described, n2: n2.described }) };
});
await check('AC01.1d', 'Cadastro: e-mail já usado (marina@demo.test, e variante MAIÚSCULA) mostra erro e foco no e-mail', async () => {
  await pg.getByLabel('Nome completo').fill('Teste Duplicado'); await pg.getByLabel('E-mail').fill('MARINA@demo.test');
  await pg.getByRole('button', { name: 'Criar conta' }).click(); await sleep(1300);
  const e = await a11yp('E-mail'); const f = await pg.evaluate(() => document.activeElement?.id && document.querySelector(`label[for="${document.activeElement.id}"]`)?.textContent.trim());
  return { ok: e.described.some((d) => /já tem cadastro/.test(d)) && f === 'E-mail', note: JSON.stringify({ e: e.described, f, url: pg.url() }) };
});
await check('AC01.1e', 'Cadastro: papel "Administração" não é oferecido', async () => {
  return { ok: (await pg.getByText(/Administração/).count()) === 0 || !(await pg.locator('input[type=radio]').evaluateAll((r) => r.some((x) => /admin/i.test(x.value)))) };
});
await check('AC01.1f', 'Cadastro: nome de 200 caracteres', async () => {
  const long = 'N'.repeat(200);
  await pg.getByLabel('Nome completo').fill(long); const v = await pg.getByLabel('Nome completo').inputValue();
  return { ok: true, note: `campo aceita/trunca para ${v.length} chars (maxlength)` };
});
await check('AC01.1g', 'Cadastro: duplo clique rápido em "Criar conta" cria 1 só usuário', async () => {
  await pg.getByLabel('Nome completo').fill('Dupla Clique'); await pg.getByLabel('E-mail').fill('dupla@teste.test');
  await pg.getByRole('button', { name: 'Criar conta' }).evaluate((bn) => { bn.click(); bn.click(); });
  await pg.waitForURL(/\/itens/, { timeout: 8000 }); await sleep(800);
  const d = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)).users.filter((u) => u.email === 'dupla@teste.test').length, DB);
  return { ok: d === 1, note: 'usuários criados=' + d };
});

// ============ REGISTRAR ITEM ============
await page.goto(BASE + '/itens/novo'); await page.waitForLoadState('networkidle');
const Q = 'O que foi encontrado?';
await check('AC08.1-item-vazio', 'Registrar item: submit vazio → erros em 5 campos (+ storedAt), foco no primeiro, anúncio', async () => {
  await page.getByRole('button', { name: 'Registrar item' }).click(); await sleep(500);
  const f = await page.evaluate(() => document.activeElement?.id && document.querySelector(`label[for="${document.activeElement.id}"]`)?.textContent.trim());
  const sr = (await page.locator('[role=status].sr-only').allInnerTexts()).join('|');
  const states = {};
  for (const l of [Q, 'Descrição', 'Categoria', 'Onde foi encontrado?', 'Onde está guardado agora?']) states[l] = await a11y(l);
  const allInvalid = Object.values(states).every((s) => s.invalid === 'true' && s.described.length > 0);
  return { ok: allInvalid && f === Q && /Corrija 5 campos/.test(sr), note: JSON.stringify({ f, sr, msgs: Object.fromEntries(Object.entries(states).map(([k, v]) => [k, v.described.join(' / ')])) }) };
});
await check('AC02.1-futura', 'Registrar item: data futura bloqueada (max do input e erro)', async () => {
  const fut = new Date(Date.now() + 3 * 864e5).toLocaleDateString('sv-SE');
  const max = await page.getByLabel('Quando foi encontrado?').getAttribute('max');
  await page.getByLabel('Quando foi encontrado?').fill(fut);
  await page.getByRole('button', { name: 'Registrar item' }).click(); await sleep(500);
  const s = await a11y('Quando foi encontrado?');
  return { ok: s.described.some((d) => /não pode ser no futuro/.test(d)), note: `max=${max}; ${JSON.stringify(s.described)}` };
});
await check('AC02.2-gif', 'Foto: GIF recusada com erro de formato e foco volta ao botão', async () => {
  await page.locator('input[type=file]').setInputFiles(IMG + '/formato.gif'); await sleep(500);
  const t = await text(); const f = await active();
  return { ok: /Formato não aceito/.test(t) && (await page.locator('img[alt^="Pré-visualização"]').count()) === 0, note: JSON.stringify(f) };
});
await check('AC02.2-falso', 'Foto: arquivo falso.jpg (texto) — o que acontece ao enviar', async () => {
  await page.locator('input[type=file]').setInputFiles(IMG + '/falso.jpg'); await sleep(500);
  const prev = await page.locator('img[alt^="Pré-visualização"]').count();
  // preencher form valido e enviar
  await page.getByLabel(Q).fill('QA Foto Falsa'); await page.getByLabel('Descrição', { exact: true }).fill('Descricao valida longa'); await page.getByLabel('Categoria').selectOption('Outros'); await page.getByLabel('Onde foi encontrado?').selectOption('Cantina'); await page.getByLabel('Quando foi encontrado?').fill(new Date().toLocaleDateString('sv-SE')); await page.getByLabel('Onde está guardado agora?').fill('Portaria');
  await page.getByRole('button', { name: 'Registrar item' }).click(); await sleep(1800);
  const t = await text(); const stillOnForm = page.url().endsWith('/itens/novo');
  const kept = await page.getByLabel(Q).inputValue();
  return { ok: stillOnForm && /Não foi possível ler a imagem|continua|inválid/i.test(t) && kept === 'QA Foto Falsa', note: `previewAntes=${prev}; erro=${(t.match(/Não foi possível ler[^\n]*/) || ['(nenhum)'])[0]}; url=${page.url()}; titulo mantido=${kept}` };
});
await check('AC02.2-grande', 'Foto: PNG > 10 MB recusada (limite)', async () => {
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.locator('input[type=file]').setInputFiles(IMG + '/enorme-acima-10MB.png'); await sleep(800);
  return { ok: /passa de 10 MB/.test(await text()) };
});
await check('AC02.2-preview', 'Foto válida: pré-visualização, Trocar foto/Remover foto', async () => {
  await page.locator('input[type=file]').setInputFiles(IMG + '/pequena-300x200.png'); await sleep(600);
  const prev = await page.locator('img[alt^="Pré-visualização"]').count();
  const trocar = await page.getByRole('button', { name: 'Trocar foto' }).count();
  await page.getByRole('button', { name: 'Remover foto' }).click(); await sleep(300);
  const prev2 = await page.locator('img[alt^="Pré-visualização"]').count();
  return { ok: prev === 1 && trocar === 1 && prev2 === 0 };
});
await check('AC08.1-item-duplo', 'Registrar item: duplo envio (2 cliques síncronos) cria 1 só item', async () => {
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.getByLabel(Q).fill('QA Duplo Envio'); await page.getByLabel('Descrição', { exact: true }).fill('Descricao valida longa'); await page.getByLabel('Categoria').selectOption('Outros'); await page.getByLabel('Onde foi encontrado?').selectOption('Cantina'); await page.getByLabel('Onde está guardado agora?').fill('Portaria');
  await page.getByRole('button', { name: 'Registrar item' }).evaluate((bn) => { bn.click(); bn.click(); });
  await page.waitForURL((u) => /^\/itens\/[^/]+$/.test(u.pathname) && u.pathname !== '/itens/novo', { timeout: 10000 }); await sleep(1000);
  const n = (await db()).items.filter((i) => i.title === 'QA Duplo Envio').length;
  return { ok: n === 1, note: 'itens criados=' + n };
});
await check('AC02.1-titulo-longo', 'Item com título de 80 chars e palavra sem espaço longa não estoura layout 360px', async () => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(BASE + '/itens/novo'); await page.waitForLoadState('networkidle');
  const longWord = 'X'.repeat(80);
  await page.getByLabel(Q).fill(longWord); await page.getByLabel('Descrição', { exact: true }).fill('Y'.repeat(120)); await page.getByLabel('Categoria').selectOption('Outros'); await page.getByLabel('Onde foi encontrado?').selectOption('Cantina'); await page.getByLabel('Onde está guardado agora?').fill('Z'.repeat(100));
  await page.getByRole('button', { name: 'Registrar item' }).click();
  await page.waitForURL((u) => /^\/itens\/[^/]+$/.test(u.pathname) && u.pathname !== '/itens/novo', { timeout: 10000 }); await sleep(1200);
  const w1 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  await page.screenshot({ path: OUT + '/forms-detalhe-texto-longo-360.png' });
  await page.goto(BASE + '/itens'); await page.waitForLoadState('networkidle'); await sleep(1000);
  const w2 = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  await page.screenshot({ path: OUT + '/forms-lista-texto-longo-360.png' });
  return { ok: w1[0] <= w1[1] && w2[0] <= w2[1], note: `detalhe sw/iw=${w1}; lista=${w2}` };
});
await page.setViewportSize({ width: 390, height: 844 });

// ---- perda de dados quando o armazenamento falha (setItem lança) ----
await check('AC02-erro-armazenamento', 'Erro de gravação (localStorage.setItem lança): formulário mantém dados, mostra erro e toast', async () => {
  await page.goto(BASE + '/itens/novo'); await page.waitForLoadState('networkidle');
  await page.getByLabel(Q).fill('QA Falha Gravacao'); await page.getByLabel('Descrição', { exact: true }).fill('Descricao valida longa'); await page.getByLabel('Categoria').selectOption('Outros'); await page.getByLabel('Onde foi encontrado?').selectOption('Cantina'); await page.getByLabel('Onde está guardado agora?').fill('Portaria');
  await page.evaluate(() => { const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function (k, v) { if (String(k).includes('campuslost:proto:v1:db')) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  await page.getByRole('button', { name: 'Registrar item' }).click(); await sleep(1500);
  const t = await text(); const kept = await page.getByLabel(Q).inputValue(); const url = page.url();
  await page.screenshot({ path: OUT + '/forms-erro-gravacao-390.png' });
  const f = await active();
  await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
  // Reenvio apos "restaurar"
  await page.getByRole('button', { name: 'Registrar item' }).click();
  await page.waitForURL((u) => /^\/itens\/[^/]+$/.test(u.pathname) && u.pathname !== '/itens/novo', { timeout: 10000 });
  return { ok: kept === 'QA Falha Gravacao' && url.endsWith('/itens/novo') && /Não foi possível/.test(t), note: `erro=${(t.match(/Não foi possível[^\n]*\n?[^\n]*/g) || []).join(' // ')}; foco=${JSON.stringify(f)}; reenvio ok -> ${page.url()}` };
});

// ============ REIVINDICACAO ============
await page.goto(BASE + '/itens/item-01/reivindicar'); await page.waitForLoadState('networkidle'); await sleep(800);
const P1 = 'Que detalhes só o dono saberia?', P2 = 'Onde e quando você perdeu?';
await check('AC08.1-claim-vazio', 'Reivindicar: vazio → 2 erros, foco na 1ª pergunta, anúncio "Corrija 2 campos"', async () => {
  await page.getByRole('button', { name: 'Enviar reivindicação' }).click(); await sleep(500);
  const s1 = await a11y(P1); const s2 = await a11y(P2); const f = await active(); const sr = (await page.locator('[role=status].sr-only').allInnerTexts()).join('|');
  return { ok: s1.invalid === 'true' && s2.invalid === 'true' && f.label === P1 && /Corrija 2 campos/.test(sr), note: JSON.stringify({ s1: s1.described, s2: s2.described, f, sr }) };
});
await check('AC04-claim-min', 'Reivindicar: respostas curtas ("abc"/"ab") rejeitadas com mínimo', async () => {
  await page.getByLabel(P1).fill('abc'); await page.getByLabel(P2).fill('ab'); await page.getByRole('button', { name: 'Enviar reivindicação' }).click(); await sleep(400);
  const s1 = await a11y(P1); const s2 = await a11y(P2);
  return { ok: s1.described.some((d) => /pelo menos 10/.test(d)) && s2.described.some((d) => /pelo menos 5/.test(d)), note: JSON.stringify([s1.described, s2.described]) };
});
await check('AC04-claim-duplo', 'Reivindicar: duplo envio cria 1 só reivindicação', async () => {
  await page.getByLabel(P1).fill('Tem um adesivo no estojo e cabo trançado.'); await page.getByLabel(P2).fill('Biblioteca, hoje cedo.');
  await page.getByRole('button', { name: 'Enviar reivindicação' }).evaluate((bn) => { bn.click(); bn.click(); });
  await page.waitForURL(/minhas-reivindicacoes/, { timeout: 10000 }); await sleep(1000);
  const n = (await db()).claims.filter((c) => c.itemId === 'item-01' && c.claimantId === 'user-marina').length;
  return { ok: n === 1, note: 'reivindicações de Marina em item-01=' + n };
});
await check('AC04-claim-erro-armazenamento', 'Reivindicar com erro de gravação: mantém respostas e mostra erro', async () => {
  await page.goto(BASE + '/itens/item-02/reivindicar'); await page.waitForLoadState('networkidle');
  await page.getByLabel(P1).fill('Tem iniciais MA na parte de trás da capinha.'); await page.getByLabel(P2).fill('Portaria, ontem.');
  await page.evaluate(() => { const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function (k, v) { if (String(k).includes(':db')) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  await page.getByRole('button', { name: 'Enviar reivindicação' }).click(); await sleep(1500);
  const t = await text(); const kept = await page.getByLabel(P1).inputValue();
  await page.screenshot({ path: OUT + '/forms-claim-erro-390.png' });
  await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
  return { ok: kept.length > 10 && /Não foi possível enviar|armazenamento/.test(t) && page.url().includes('/reivindicar'), note: (t.match(/Não foi possível[^\n]*/) || ['(nada)'])[0] };
});

// ============ EDICAO (admin) ============
const pa = await newPage(await newCtx(b)); await demoLogin(pa, 'admin');
await pa.goto(BASE + '/admin/itens/item-01/editar'); await pa.waitForLoadState('networkidle'); await sleep(1200);
await check('AC06.1-editar-prefill', 'Editar: campos vêm preenchidos; salvar altera e mostra toast', async () => {
  const t = await pa.getByLabel('O que foi encontrado?').inputValue();
  await pa.getByLabel('O que foi encontrado?').fill('Fones de ouvido sem fio (editado)');
  await pa.getByRole('button', { name: 'Salvar alterações' }).click(); await sleep(1500);
  const d = (await pa.evaluate((k) => JSON.parse(localStorage.getItem(k)), DB)).items.find((i) => i.id === 'item-01').title;
  return { ok: t === 'Fones de ouvido sem fio' && /editado/.test(d), note: `url=${pa.url()} título=${d}` };
});
await check('AC06.1-editar-invalido', 'Editar: limpar título mostra erro e mantém na página', async () => {
  await pa.goto(BASE + '/admin/itens/item-01/editar'); await pa.waitForLoadState('networkidle'); await sleep(1200);
  await pa.getByLabel('O que foi encontrado?').fill(''); await pa.getByRole('button', { name: 'Salvar alterações' }).click(); await sleep(500);
  return { ok: /Informe um título/.test(await pa.locator('body').innerText()) && pa.url().includes('/editar') };
});
await check('AC06.1-excluir-cancelar', 'Excluir: Esc fecha diálogo e devolve o foco ao botão "Excluir item"', async () => {
  await pa.goto(BASE + '/admin/itens/item-02/editar'); await pa.waitForLoadState('networkidle'); await sleep(1200);
  const trigger = pa.getByRole('button', { name: 'Excluir item' }).first();
  await trigger.click(); await sleep(400);
  const open = await pa.getByRole('dialog').count();
  await pa.keyboard.press('Escape'); await sleep(400);
  const closed = await pa.getByRole('dialog').count();
  const foc = await pa.evaluate(() => document.activeElement?.textContent?.trim());
  const still = (await pa.evaluate((k) => JSON.parse(localStorage.getItem(k)), DB)).items.some((i) => i.id === 'item-02');
  return { ok: open === 1 && closed === 0 && /Excluir item/.test(foc) && still, note: `foco após Esc="${foc}"` };
});
info('console-forms', 'console', JSON.stringify({ page: page.consoleMsgs, p2: p2.consoleMsgs, pa: pa.consoleMsgs }));
save();
await b.close();
