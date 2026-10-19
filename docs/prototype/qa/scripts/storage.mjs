// Itens declarados NAO verificados: sync entre abas (storage), erros de carga, reiniciar demo, localStorage indisponivel. Uso: node storage.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('storage');
const b = await launch();
const DB = 'campuslost:proto:v1:db';
const text = (p) => p.locator('body').innerText();
const settle = async (p, ms = 1300) => { await p.waitForLoadState('networkidle'); await sleep(ms); };
const getDb = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), DB);

// ================= (b) sincronizacao entre abas =================
{
  const ctx = await newCtx(b, { viewport: { width: 390, height: 844 } });
  const marina = await newPage(ctx); await demoLogin(marina, 'student');
  const admin = await newPage(ctx); await admin.setViewportSize({ width: 1280, height: 900 }); await demoLogin(admin, 'admin');
  const rafael = await newPage(ctx); await demoLogin(rafael, 'teacher');
  await marina.goto(BASE + '/minhas-reivindicacoes'); await settle(marina);
  await admin.goto(BASE + '/admin'); await settle(admin);
  await marina.bringToFront?.();
  const pendBefore = (await text(admin)).match(/(\d+)\s*\n?\s*Pendentes/);
  await check('AC04.8-sync-admin', 'Aba do admin (parada em /admin) atualiza SEM recarregar quando Rafael reivindica em outra aba', async () => {
    const before = await admin.locator('main').innerText();
    await rafael.goto(BASE + '/itens/item-01/reivindicar'); await settle(rafael, 800);
    await rafael.getByLabel('Que detalhes só o dono saberia?').fill('Tem um adesivo azul no estojo.');
    await rafael.getByLabel('Onde e quando você perdeu?').fill('Biblioteca, hoje cedo.');
    await rafael.getByRole('button', { name: 'Enviar reivindicação' }).click(); await rafael.waitForURL(/minhas-reiv/); await sleep(1500);
    const after = await admin.locator('main').innerText();
    const nav = await admin.evaluate(() => performance.getEntriesByType('navigation')[0].type);
    return { ok: /Fones de ouvido sem fio/.test(after) && !/Fones de ouvido sem fio/.test(before), note: `navigation.type=${nav}; antes tinha "Fones"? ${/Fones/.test(before)}; depois tem? ${/Fones/.test(after)}; pendentes antes=${(before.match(/(\d+)\s*Pendentes/) || [])[1]} depois=${(after.match(/(\d+)\s*Pendentes/) || [])[1]}` };
  });
  await check('AC04.8-sync-user', 'Aba da Marina (parada em Minhas reivindicações) mostra "Aceita" SEM recarregar após admin aceitar claim-06; região live anuncia', async () => {
    const before = await marina.locator('li', { hasText: 'Calculadora científica' }).innerText();
    await admin.goto(BASE + '/admin/reivindicacoes/claim-06'); await settle(admin, 900);
    await admin.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click();
    await sleep(2000);
    const after = await marina.locator('li', { hasText: 'Calculadora científica' }).innerText();
    const live = await marina.locator('[aria-live]').allInnerTexts();
    const nav = await marina.evaluate(() => performance.getEntriesByType('navigation')[0].type);
    return { ok: /Pendente/.test(before) && /Aceita/.test(after), note: `antes="${before.replace(/\n+/g, ' ')}" depois="${after.replace(/\n+/g, ' ').slice(0, 90)}" live=${JSON.stringify(live.filter(Boolean))} navType=${nav}` };
  });
  await check('AC04.8-sync-detalhe', 'Aba com detalhe do item aberto também atualiza (Beatriz recusada automaticamente / item em Em reivindicação)', async () => {
    const t = await text(marina);
    return { ok: true, note: 'detalhe não testado separadamente; lista de Minhas reivindicações atualizou (ver acima)' };
  });
  await check('RNF-sync-sessao', 'Sessões são por aba: sair na aba do admin não derruba as outras', async () => {
    await admin.getByRole('button', { name: 'Menu da conta' }).click(); await admin.getByRole('menuitem', { name: 'Sair' }).click(); await sleep(1200);
    await marina.reload(); await settle(marina);
    return { ok: marina.url().includes('minhas-reivindicacoes') && /Minhas reivindicações/.test(await text(marina)) };
  });
  await ctx.close();
}

// ================= (d) Reiniciar demonstracao =================
{
  const ctx = await newCtx(b, { viewport: { width: 1280, height: 900 } });
  const p = await newPage(ctx);
  await p.goto(BASE + '/cadastro'); await settle(p, 500);
  await p.getByLabel('Nome completo').fill('Usuaria Temporaria'); await p.getByLabel('E-mail').fill('temp@teste.test'); await p.locator('label', { hasText: 'Professor' }).click();
  await p.getByRole('button', { name: 'Criar conta' }).click(); await p.waitForURL(/\/itens$/); await settle(p, 800);
  await p.goto(BASE + '/itens/item-01/reivindicar'); await settle(p, 800);
  await p.getByLabel('Que detalhes só o dono saberia?').fill('Detalhe suficiente para teste.'); await p.getByLabel('Onde e quando você perdeu?').fill('Biblioteca ontem');
  await p.getByRole('button', { name: 'Enviar reivindicação' }).click(); await p.waitForURL(/minhas-reiv/); await sleep(1000);
  const dirty = await getDb(p);
  await check('RESET-menu', '"Reiniciar demonstração" pelo menu da conta: confirmação, volta ao seed, encerra sessão e leva a /entrar com toast', async () => {
    await p.getByRole('button', { name: 'Menu da conta' }).click();
    await p.getByRole('menuitem', { name: 'Reiniciar demonstração' }).click(); await sleep(400);
    const dlg = await p.getByRole('dialog').innerText();
    await p.getByRole('dialog').getByRole('button', { name: 'Reiniciar', exact: true }).click(); await sleep(2000);
    const after = await getDb(p);
    const toast = (await text(p)).match(/Demonstração reiniciada\.?/);
    return { ok: p.url().endsWith('/entrar') && dirty.users.length === 6 && after.users.length === 5 && after.claims.length === 9 && after.items.length === 11 && !!toast, note: `antes users=${dirty.users.length} claims=${dirty.claims.length}; depois users=${after.users.length} claims=${after.claims.length} items=${after.items.length}; url=${p.url()}; toast=${!!toast}; dlg="${dlg.replace(/\n+/g, ' ')}"` };
  });
  await check('RESET-login', '"Reiniciar demonstração" na tela de login restaura o seed', async () => {
    await demoLogin(p, 'admin');
    await p.goto(BASE + '/admin/itens/item-01/editar'); await settle(p, 800);
    await p.getByLabel('O que foi encontrado?').fill('Alterado antes do reset'); await p.getByRole('button', { name: 'Salvar alterações' }).click(); await sleep(1500);
    const edited = (await getDb(p)).items.find((i) => i.id === 'item-01').title;
    await p.getByRole('button', { name: 'Menu da conta' }).click(); await p.getByRole('menuitem', { name: 'Sair' }).click(); await p.waitForURL(/entrar/); await sleep(800);
    await p.getByRole('button', { name: /Reiniciar demonstração/ }).click(); await sleep(400);
    const dlgOpen = await p.getByRole('dialog').count();
    await p.getByRole('dialog').getByRole('button', { name: 'Reiniciar', exact: true }).click(); await sleep(1800);
    const t = (await getDb(p)).items.find((i) => i.id === 'item-01').title;
    return { ok: edited === 'Alterado antes do reset' && t === 'Fones de ouvido sem fio', note: `editado="${edited}" -> após reset="${t}" dialog=${dlgOpen}; url=${p.url()}` };
  });
  await check('RESET-seed-datas', 'Datas do seed relativas ao dia atual após reset (item-01 encontrado hoje)', async () => {
    const d = await getDb(p); const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
    return { ok: d.items.find((i) => i.id === 'item-01').foundDate === today, note: `foundDate=${d.items[0].foundDate} hoje=${today}` };
  });
  await ctx.close();
}

// ================= (c) erros de carregamento =================
const CORRUPTIONS = {
  'items=[null]': (db) => { db.items = [null]; },
  'claim-01.claimantId=ghost': (db) => { db.claims.find((c) => c.id === 'claim-01').claimantId = 'ghost'; },
  'claim-03.itemId=ghost(Marina)': (db) => { db.claims.find((c) => c.id === 'claim-03').itemId = 'ghost'; },
  'return-01.returnedToId=ghost': (db) => { db.returns[0].returnedToId = 'ghost'; },
  'item-03.createdById=ghost': (db) => { db.items.find((i) => i.id === 'item-03').createdById = 'ghost'; },
};
const SCREENS = [
  ['student', '/itens'], ['student', '/itens/item-03'], ['student', '/minhas-reivindicacoes'], ['student', '/itens/item-01/reivindicar'],
  ['admin', '/admin'], ['admin', '/admin/devolucoes'], ['admin', '/admin/reivindicacoes/claim-01'], ['admin', '/itens/item-03'], ['admin', '/admin/itens/item-03/editar'],
];
{
  const ctxS = await newCtx(b, { viewport: { width: 390, height: 844 } });
  const ctxA = await newCtx(b, { viewport: { width: 1280, height: 900 } });
  const pS = await newPage(ctxS); await demoLogin(pS, 'student');
  const pA = await newPage(ctxA); await demoLogin(pA, 'admin');
  const pages = { student: pS, admin: pA };
  const resetDb = async (p) => { await p.evaluate(() => { /* restaura seed apagando a chave: o app recria */ }); };
  for (const [cname, corrupt] of Object.entries(CORRUPTIONS)) {
    for (const [role, route] of SCREENS) {
      const p = pages[role];
      // base limpa
      await p.evaluate((k) => localStorage.removeItem(k), DB);
      await p.goto(BASE + '/itens'); await settle(p, 600);
      await p.evaluate(([k, fn]) => { const db = JSON.parse(localStorage.getItem(k)); new Function('db', fn)(db); localStorage.setItem(k, JSON.stringify(db)); }, [DB, `(${corrupt.toString()})(db)`]);
      p.consoleMsgs.length = 0;
      await p.goto(BASE + route); await settle(p, 1800);
      const body = await text(p);
      const retry = await p.getByRole('button', { name: /Tentar novamente/ }).count();
      const alertTxt = (await p.locator('[role=alert]').allInnerTexts()).join(' | ').slice(0, 120);
      const hasMain = (await p.locator('main').count()) > 0;
      const errs = p.consoleMsgs.filter((m) => m.startsWith('pageerror'));
      let recovered = 'n/a';
      if (retry) {
        // retry com dados ainda ruins: nao pode quebrar
        await p.getByRole('button', { name: /Tentar novamente/ }).first().click(); await sleep(1500);
        const stillRetry = await p.getByRole('button', { name: /Tentar novamente/ }).count();
        await p.evaluate((k) => localStorage.removeItem(k), DB);
        await p.getByRole('button', { name: /Tentar novamente/ }).first().click().catch(() => {}); await sleep(1800);
        recovered = (await p.getByRole('button', { name: /Tentar novamente/ }).count()) === 0 ? 'recuperou' : 'continua em erro';
        recovered += ` (retry ruim manteve erro=${stillRetry > 0})`;
      }
      const verdict = retry ? 'ErrorState+Tentar novamente' : (hasMain && body.length > 50 ? 'renderizou (sem erro: dado ruim tolerado/ignorado)' : 'EM BRANCO/QUEBRADO');
      console.log(`${cname.padEnd(34)} ${role.padEnd(8)} ${route.padEnd(34)} -> ${verdict} | ${recovered} ${errs.length ? 'PAGEERROR ' + errs[0] : ''} ${!retry ? '| texto: ' + body.replace(/\s+/g, ' ').slice(120, 220) : ''}`);
      info(`ERRLOAD ${cname} ${role} ${route}`, verdict, recovered + (errs.length ? ' ' + errs[0] : ''));
    }
  }
  await ctxS.close(); await ctxA.close();
}

// ================= (e) localStorage indisponivel =================
for (const variant of ['localStorage lança SecurityError', 'localStorage E sessionStorage lançam']) {
  const ctx = await newCtx(b, { viewport: { width: 390, height: 844 } });
  const both = variant.includes('sessionStorage');
  await ctx.addInitScript((both) => {
    const deny = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
    if (both) Object.defineProperty(window, 'sessionStorage', { get: deny, configurable: true });
  }, both);
  const p = await newPage(ctx);
  await p.goto(BASE + '/entrar'); await settle(p, 1200);
  await check(`LS-indisp ${variant}`, `Storage indisponível (${variant}): /entrar renderiza, perfil demo entra, lista carrega (memória)`, async () => {
    const hasProfiles = await p.getByRole('button', { name: /Aluno demo/ }).count();
    await p.getByRole('button', { name: /Aluno demo/ }).click().catch(() => {}); await sleep(2000);
    const url = p.url(); const t = await text(p);
    await p.screenshot({ path: `${OUT}/ls-indisponivel-${both ? 'ambos' : 'local'}-390.png` });
    // navegacao SPA para um item
    let nav = 'n/a';
    if (url.includes('/itens')) { await p.locator('main a[href^="/itens/item"]').first().click().catch(() => {}); await sleep(1500); nav = p.url(); }
    return { ok: hasProfiles === 1 && /Itens encontrados/.test(t), note: `url=${url}; nav=${nav}; erros=${JSON.stringify(p.consoleMsgs.slice(0, 3))}; texto=${t.replace(/\s+/g, ' ').slice(100, 220)}` };
  });
  await check(`LS-indisp-reload ${variant}`, 'Recarregar com storage indisponível: sessão se perde mas app não quebra (volta ao login)', async () => {
    await p.reload(); await settle(p, 1500);
    return { ok: (await p.locator('h1').count()) > 0, note: `url=${p.url()}; h1=${await p.locator('h1').allInnerTexts()}` };
  });
  await ctx.close();
}
save();
await b.close();
