// Estados de interface por tela: loading, vazio, erro, sucesso (toasts), indisponivel; casos de corrida. Uso: node states.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('states');
const DB = 'campuslost:proto:v1:db';
const b = await launch();
const settle = async (p, ms = 1300) => { await p.waitForLoadState('networkidle'); await sleep(ms); };
const txt = (p) => p.locator('body').innerText();
const mut = (p, fnSrc) => p.evaluate(([k, src]) => { const db = JSON.parse(localStorage.getItem(k)); new Function('db', src)(db); localStorage.setItem(k, JSON.stringify(db)); }, [DB, fnSrc]);
const reset = (p) => p.evaluate((k) => localStorage.removeItem(k), DB);

// ===== LOADING =====
const ctx = await newCtx(b, { viewport: { width: 390, height: 844 } });
const stu = await newPage(ctx); await demoLogin(stu, 'student');
const adm = await newPage(ctx); await adm.setViewportSize({ width: 1280, height: 900 }); await demoLogin(adm, 'admin');
const LOAD = [[stu, '/itens'], [stu, '/itens/item-01'], [stu, '/itens/item-01/reivindicar'], [stu, '/minhas-reivindicacoes'], [stu, '/itens/novo'], [adm, '/admin'], [adm, '/admin/reivindicacoes/claim-01'], [adm, '/admin/itens/item-01/editar'], [adm, '/admin/devolucoes'], [adm, '/itens/item-03']];
for (const [p, r] of LOAD) {
  await check(`LOADING ${r}`, `Loading (skeleton/região busy) visível ao abrir ${r}`, async () => {
    await p.goto(BASE + r, { waitUntil: 'commit' });
    let seen = null;
    for (let i = 0; i < 40 && !seen; i++) {
      seen = await p.evaluate(() => { const e = document.querySelector('[aria-busy=true]'); const s = document.querySelector('[role=status]:not(.sr-only):not(:empty)'); const sr = [...document.querySelectorAll('[role=status]')].map((x) => x.textContent.trim()).filter((t) => /Carregando/.test(t)); const sk = document.querySelector('.skeleton, [class*=skeleton]'); return sr.length || e || sk ? { sr, busy: !!e, skel: !!sk } : null; });
      if (!seen) await sleep(50);
    }
    await settle(p, 800);
    return { ok: !!seen, note: JSON.stringify(seen) };
  });
}

// ===== VAZIO =====
const c2 = await newCtx(b, { viewport: { width: 390, height: 844 } });
const ps = await newPage(c2); await demoLogin(ps, 'student');
const pa = await newPage(c2); await pa.setViewportSize({ width: 1280, height: 900 }); await demoLogin(pa, 'admin');
await check('EMPTY /itens', 'Lista vazia (nenhum item): mensagem + ação "Registrar item"', async () => {
  await mut(ps, 'db.items.forEach(i => i.status="returned"); db.claims = db.claims.filter(c=>false)');
  await ps.goto(BASE + '/itens'); await settle(ps);
  const t = await txt(ps); await ps.screenshot({ path: OUT + '/state-vazio-itens-390.png' });
  return { ok: /Nenhum item registrado ainda/.test(t) && (await ps.getByRole('link', { name: 'Registrar item' }).count()) >= 1, note: (t.match(/Nenhum item registrado[^\n]*\n[^\n]*/) || [''])[0].replace(/\n/g, ' | ') };
});
await check('EMPTY /minhas-reivindicacoes', 'Minhas reivindicações vazio: mensagem + "Ver itens"', async () => {
  await ps.goto(BASE + '/minhas-reivindicacoes'); await settle(ps);
  const t = await txt(ps); await ps.screenshot({ path: OUT + '/state-vazio-minhas-390.png' });
  return { ok: /Você ainda não reivindicou nenhum item/.test(t) && (await ps.getByRole('link', { name: /Ver itens/ }).count()) >= 1, note: t.replace(/\n+/g, ' | ').slice(130, 330) };
});
await check('EMPTY /admin', 'Painel admin vazio: mensagens das duas listas', async () => {
  await pa.goto(BASE + '/admin'); await settle(pa);
  const t = await txt(pa); await pa.screenshot({ path: OUT + '/state-vazio-admin-1280.png' });
  return { ok: /Nenhuma reivindicação pendente/.test(t), note: t.replace(/\n+/g, ' | ').slice(150, 560) };
});
await check('EMPTY /admin/devolucoes', 'Devoluções vazio ("Nenhuma devolução registrada ainda")', async () => {
  await mut(pa, 'db.returns = []');
  await pa.goto(BASE + '/admin/devolucoes'); await settle(pa);
  const t = await txt(pa); await pa.screenshot({ path: OUT + '/state-vazio-devolucoes-1280.png' });
  return { ok: /Nenhuma devolução registrada ainda/.test(t), note: t.replace(/\n+/g, ' | ').slice(130, 330) };
});
await check('EMPTY detalhe admin sem reivindicações', 'Detalhe do item (admin) sem reivindicações: seção vazia explicativa', async () => {
  await reset(pa); await pa.goto(BASE + '/itens/item-01'); await settle(pa);
  const t = await txt(pa);
  return { ok: true, note: t.replace(/\n+/g, ' | ').slice(130, 520) };
});
await reset(ps); await reset(pa);

// ===== SUCESSO (toasts) =====
await check('TOASTS', 'Toasts de sucesso por ação (registrar, salvar, excluir, aceitar, recusar, devolver)', async () => {
  const seen = {};
  const toast = async (p) => { for (let i = 0; i < 25; i++) { const t = await p.locator('div.animate-rise:has(button[aria-label="Dispensar aviso"])').allInnerTexts(); if (t.length) return t[0].replace(/\n+/g, ' '); await sleep(100); } return '(nenhum toast visível)'; };
  await pa.goto(BASE + '/itens/novo'); await settle(pa, 600);
  await pa.getByLabel('O que foi encontrado?').fill('QA Toast'); await pa.getByLabel('Descrição', { exact: true }).fill('Descricao valida longa'); await pa.getByLabel('Categoria').selectOption('Outros'); await pa.getByLabel('Onde foi encontrado?').selectOption('Cantina'); await pa.getByLabel('Onde está guardado agora?').fill('Portaria');
  await pa.getByRole('button', { name: 'Registrar item' }).click(); seen.registrar = await toast(pa); await pa.waitForURL(/\/itens\/item-/); await sleep(800);
  const id = pa.url().split('/').pop();
  await pa.goto(BASE + `/admin/itens/${id}/editar`); await settle(pa, 600);
  await pa.getByLabel('Descrição', { exact: true }).fill('Descricao alterada valida'); await pa.getByRole('button', { name: 'Salvar alterações' }).click(); seen.salvar = await toast(pa); await sleep(1500);
  await pa.goto(BASE + `/admin/itens/${id}/editar`); await settle(pa, 600);
  await pa.getByRole('button', { name: 'Excluir item' }).first().click(); await pa.getByRole('dialog').getByRole('button', { name: 'Excluir item' }).click(); seen.excluir = await toast(pa); await sleep(1500);
  await pa.goto(BASE + '/admin/reivindicacoes/claim-02'); await settle(pa, 600);
  await pa.getByRole('button', { name: 'Recusar', exact: true }).click(); await pa.getByRole('dialog').getByRole('button', { name: 'Recusar reivindicação' }).click(); seen.recusar = await toast(pa); await sleep(1500);
  await pa.goto(BASE + '/admin/reivindicacoes/claim-01'); await settle(pa, 600);
  await pa.getByRole('button', { name: 'Aceitar', exact: true }).click(); await pa.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click(); seen.aceitar = await toast(pa); await sleep(1500);
  await pa.getByRole('button', { name: 'Registrar devolução' }).click(); await pa.getByRole('dialog').getByRole('button', { name: 'Registrar devolução' }).click(); seen.devolver = await toast(pa); await sleep(1500);
  const urlAfter = pa.url();
  return { ok: Object.values(seen).every((s) => !/nenhum toast/.test(s)), note: JSON.stringify(seen) + ' url após devolução=' + urlAfter };
});

// ===== FALHA DE ACAO DO ADMIN (erro de gravacao) =====
await check('ACTION-ERR admin aceitar', 'Erro de gravação ao aceitar: dialog informa erro, dados mantidos, sem quebrar', async () => {
  await reset(pa); await pa.goto(BASE + '/admin/reivindicacoes/claim-06'); await settle(pa, 700);
  await pa.getByRole('button', { name: 'Aceitar', exact: true }).click(); await sleep(300);
  await pa.evaluate(() => { const o = Storage.prototype.setItem; window.__o = o; Storage.prototype.setItem = function (k, v) { if (String(k).includes(':db')) throw new DOMException('q', 'QuotaExceededError'); return o.call(this, k, v); }; });
  await pa.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click(); await sleep(1500);
  const t = await txt(pa); const dlg = await pa.getByRole('dialog').count();
  await pa.screenshot({ path: OUT + '/state-erro-acao-admin-1280.png' });
  await pa.evaluate(() => { Storage.prototype.setItem = window.__o; });
  const status = (await pa.evaluate((k) => JSON.parse(localStorage.getItem(k)).claims.find((c) => c.id === 'claim-06').status, DB));
  return { ok: status === 'pending' && /Não foi possível|armazenamento/.test(t), note: `dialog aberto=${dlg}; status=${status}; texto="${(t.match(/(Não foi possível|Algo deu)[^\n]*/) || ['(sem mensagem)'])[0]}"` };
});

// ===== CORRIDAS / TELA OBSOLETA =====
await check('RACE claim-item-excluido', 'Aluna com formulário de reivindicação aberto; admin exclui o item; ao enviar a mensagem é adequada (não sugere "tente de novo")', async () => {
  await reset(ps); await reset(pa);
  await ps.goto(BASE + '/itens/item-06/reivindicar'); await settle(ps, 700);
  await ps.getByLabel('Que detalhes só o dono saberia?').fill('Amassado perto da tampa e adesivo.'); await ps.getByLabel('Onde e quando você perdeu?').fill('Cantina ontem');
  await pa.goto(BASE + '/admin/itens/item-06/editar'); await settle(pa, 700);
  await pa.getByRole('button', { name: 'Excluir item' }).first().click(); await pa.getByRole('dialog').getByRole('button', { name: 'Excluir item' }).click(); await sleep(2000);
  await sleep(1000);
  const t = await txt(ps); await ps.screenshot({ path: OUT + '/state-race-item-excluido-390.png' });
  return { ok: /não encontrado|excluíd|não existe|Item não/i.test(t), note: `aba da aluna (sem recarregar) agora mostra: "${t.replace(/\n+/g, ' ').slice(100, 300)}"` };
});
await check('RACE sessão encerrada em outra ação (reset enquanto logado)', 'Reiniciar demonstração em outra aba derruba usuário criado: a aba logada volta ao login sem quebrar', async () => {
  const c3 = await newCtx(b, { viewport: { width: 390, height: 844 } });
  const p1 = await newPage(c3); await p1.goto(BASE + '/cadastro'); await settle(p1, 500);
  await p1.getByLabel('Nome completo').fill('Efemera Teste'); await p1.getByLabel('E-mail').fill('efemera@teste.test'); await p1.locator('label', { hasText: 'Aluno' }).click(); await p1.getByRole('button', { name: 'Criar conta' }).click(); await p1.waitForURL(/\/itens$/); await sleep(800);
  const p2 = await newPage(c3); await demoLogin(p2, 'admin');
  await p2.getByRole('button', { name: 'Menu da conta' }).click(); await p2.getByRole('menuitem', { name: 'Reiniciar demonstração' }).click(); await p2.getByRole('dialog').getByRole('button', { name: 'Reiniciar', exact: true }).click(); await sleep(2500);
  await sleep(800);
  const t = await txt(p1); const u = p1.url();
  await p1.screenshot({ path: OUT + '/state-sessao-invalidada-390.png' });
  await c3.close();
  return { ok: /entrar/.test(u) || /Entrar|perfil de demonstra/i.test(t), note: `url=${u}; texto="${t.replace(/\n+/g, ' ').slice(0, 160)}"` };
});
info('console', 'console', JSON.stringify({ stu: stu.consoleMsgs, adm: adm.consoleMsgs, ps: ps.consoleMsgs, pa: pa.consoleMsgs }));
save();
await b.close();
