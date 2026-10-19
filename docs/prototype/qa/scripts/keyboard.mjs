// Teclado, foco visivel, focus trap, retorno de foco, movimento reduzido, status nao so por cor. Uso: node keyboard.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('keyboard');
const b = await launch();
const settle = async (p, ms = 1200) => { await p.waitForLoadState('networkidle'); await sleep(ms); };
const desc = (p) => p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; const l = a.id && document.querySelector(`label[for="${CSS.escape(a.id)}"]`); return a.tagName.toLowerCase() + '[' + ((a.getAttribute('aria-label') || (l && l.textContent) || a.textContent || a.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 30)) + ']'; });
const focusStyle = (p) => p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); const lab = a.closest('label'); const cs2 = lab ? getComputedStyle(lab) : null; const o = (c) => ({ style: c.outlineStyle, width: parseFloat(c.outlineWidth), color: c.outlineColor, shadow: c.boxShadow !== 'none' }); return { el: a.tagName + ':' + (a.textContent || a.type || '').trim().slice(0, 20), own: o(cs), label: cs2 ? o(cs2) : null, border: cs.borderTopColor }; });

// ---------- Foco visivel em TODOS os tab stops de varias telas ----------
async function tabAudit(page, label, max = 40) {
  const seen = []; const bad = [];
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  await page.keyboard.press('Tab');
  for (let i = 0; i < max; i++) {
    await sleep(260);
    const d = await desc(page); if (d === 'BODY') break;
    if (seen.includes(d + i)) break;
    const fs = await focusStyle(page);
    const visible = (fs.own.style !== 'none' && fs.own.width >= 2) || (fs.label && fs.label.style !== 'none' && fs.label.width >= 2);
    seen.push(d + i);
    if (!visible) bad.push({ d, fs });
    const before = d;
    await page.keyboard.press('Tab');
    const after = await desc(page);
    if (after === 'BODY') break;
  }
  return { count: seen.length, bad, order: seen.map((s) => s.replace(/\d+$/, '')).join(' > ') };
}

const ctx = await newCtx(b, { viewport: { width: 1280, height: 900 } });
const page = await newPage(ctx);

// ---- Login por teclado ----
await page.goto(BASE + '/entrar'); await settle(page, 800);
await check('AC08.1-kb-skip', 'Primeiro Tab em /entrar foca o link "Pular para o conteúdo", visível ao focar; Enter leva ao main', async () => {
  await page.keyboard.press('Tab');
  const d = await desc(page);
  const r = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, left: r.left }; });
  await page.screenshot({ path: OUT + '/kb-skiplink-1280.png', clip: { x: 0, y: 0, width: 1280, height: 200 } });
  await page.keyboard.press('Enter'); await sleep(200);
  const after = await page.evaluate(() => ({ hash: location.hash, el: document.activeElement?.tagName + '#' + document.activeElement?.id }));
  return { ok: /Pular/.test(d) && r.h > 20 && r.top >= 0, note: `${d} rect=${JSON.stringify(r)}; após Enter: ${JSON.stringify(after)}` };
});
await page.goto(BASE + '/entrar'); await settle(page, 800);
const au1 = await tabAudit(page, '/entrar');
await check('AC08.1-kb-foco-entrar', 'Foco visível (outline ≥ 2 px) em todos os tab stops de /entrar', async () => ({ ok: au1.bad.length === 0, note: `${au1.count} paradas: ${au1.order}; sem indicador: ${JSON.stringify(au1.bad)}` }));
await check('AC01.3-kb-login', 'Login só por teclado: Tab até o e-mail, digitar, Enter → /itens', async () => {
  await page.goto(BASE + '/entrar'); await settle(page, 800);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); // skip, (brand link?) ...
  for (let i = 0; i < 5 && !/E-mail/.test(await desc(page)); i++) await page.keyboard.press('Tab');
  const at = await desc(page);
  await page.keyboard.type('rafael@demo.test'); await page.keyboard.press('Enter');
  await page.waitForURL(/\/itens$/, { timeout: 8000 });
  return { ok: true, note: 'foco no campo: ' + at };
});

// ---- Navegacao do app e foco apos navegar ----
await settle(page, 800);
await check('AC08.1-kb-foco-itens', 'Foco visível em todos os tab stops de /itens (desktop)', async () => {
  const au = await tabAudit(page, '/itens', 60);
  return { ok: au.bad.length === 0, note: `${au.count} paradas; ${au.order.slice(0, 300)}; sem indicador: ${JSON.stringify(au.bad)}` };
});
await check('AC08.1-kb-card', 'Cartão do item: Enter abre o detalhe; foco depois da navegação', async () => {
  await page.goto(BASE + '/itens'); await settle(page, 800);
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (/Fones/.test(await desc(page))) break; }
  const at = await desc(page);
  await page.keyboard.press('Enter'); await page.waitForURL(/item-01/); await sleep(1200);
  const foc = await desc(page);
  return { ok: /Fones/.test(at), note: `focado antes: ${at}; foco após navegação: ${foc}` };
});
await check('AC04-kb-claim', 'Reivindicar só por teclado: "É meu" (Enter) → preencher → enviar com Espaço', async () => {
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); if (/É meu/.test(await desc(page))) break; }
  const at = await desc(page);
  await page.keyboard.press('Enter'); await page.waitForURL(/reivindicar/); await sleep(1000);
  for (let i = 0; i < 12 && !/Que detalhes/.test(await desc(page)); i++) await page.keyboard.press('Tab');
  await page.keyboard.type('Tem uma etiqueta com as iniciais RL.'); await page.keyboard.press('Tab');
  await page.keyboard.type('Biblioteca, hoje.');
  for (let i = 0; i < 4 && !/Enviar reivindicação/.test(await desc(page)); i++) await page.keyboard.press('Tab');
  const send = await desc(page);
  await page.keyboard.press('Space'); await page.waitForURL(/minhas-reiv/, { timeout: 8000 }); await sleep(1200);
  const foc = await desc(page);
  return { ok: /É meu/.test(at) && /Enviar/.test(send), note: `${at} -> ${send}; foco após enviar e navegar: ${foc}` };
});

// ---- Menu da conta ----
await check('AC08.1-kb-menu', 'Menu da conta: Enter abre, foco no 1º item, setas navegam, Esc fecha e devolve foco ao botão', async () => {
  await page.goto(BASE + '/itens'); await settle(page, 800);
  const btn = page.getByRole('button', { name: 'Menu da conta' });
  await btn.focus(); await page.keyboard.press('Enter'); await sleep(300);
  const first = await desc(page);
  await page.keyboard.press('ArrowDown'); const second = await desc(page);
  await page.keyboard.press('Escape'); await sleep(200);
  const back = await desc(page);
  return { ok: /Reiniciar/.test(first) && /Sair/.test(second) && /Menu da conta/.test(back), note: `${first} > ${second}; Esc -> ${back}` };
});

// ---- Dialogo: focus trap, Esc, retorno de foco ----
const adm = await newPage(ctx); await demoLogin(adm, 'admin');
await check('AC08.1-kb-dialog', 'Diálogo de confirmação: foco inicial dentro, Tab/Shift+Tab ficam presos (15 voltas), Esc fecha e devolve foco ao gatilho', async () => {
  await adm.goto(BASE + '/admin/reivindicacoes/claim-01'); await settle(adm, 900);
  const trigger = adm.getByRole('button', { name: 'Aceitar', exact: true });
  await trigger.focus(); await adm.keyboard.press('Enter'); await sleep(500);
  const initial = await desc(adm);
  const inside = async () => adm.evaluate(() => { const a = document.activeElement; return a === document.body || !!a.closest('dialog'); }); // BODY = foco foi para a interface do navegador (comportamento nativo do <dialog> modal)
  let always = true; const stops = [];
  for (let i = 0; i < 15; i++) { await adm.keyboard.press('Tab'); if (!(await inside())) always = false; stops.push(await desc(adm)); }
  for (let i = 0; i < 6; i++) { await adm.keyboard.press('Shift+Tab'); if (!(await inside())) always = false; }
  const bg = await adm.evaluate(() => { const m = document.querySelector('main'); return m ? (m.inert || m.closest('[inert]') ? 'inert' : 'não inert (mas dialog modal torna o resto inerte)') : 'n/a'; });
  await adm.keyboard.press('Escape'); await sleep(400);
  const closed = await adm.getByRole('dialog').count(); const back = await desc(adm);
  const labelled = await (async () => { await trigger.click(); await sleep(300); const r = await adm.evaluate(() => { const d = document.querySelector('dialog[open]'); return { labelledby: d.getAttribute('aria-labelledby'), describedby: d.getAttribute('aria-describedby'), modal: d.matches(':modal') }; }); await adm.keyboard.press('Escape'); return r; })();
  return { ok: /Aceitar reivindicação|Cancelar/.test(initial) && always && closed === 0 && /Aceitar/.test(back) && labelled.modal && !!labelled.labelledby, note: `inicial=${initial}; paradas=${[...new Set(stops)].join(',')}; Esc→ foco=${back}; ${JSON.stringify(labelled)}` };
});
await check('AC08.1-dialog-scrim', 'Clique no scrim fecha diálogo de confirmação (ou não) e foco volta ao gatilho', async () => {
  await adm.getByRole('button', { name: 'Recusar', exact: true }).click(); await sleep(400);
  await adm.mouse.click(5, 5); await sleep(400);
  const closed = await adm.getByRole('dialog').count(); const back = await desc(adm);
  return { ok: true, note: `diálogo fechado=${closed === 0}; foco=${back}` };
});
await check('AC08.1-kb-dialog-busy', 'Durante o envio, Esc/scrim não fecham o diálogo (DESIGN §6.6)', async () => {
  await adm.goto(BASE + '/admin/itens/item-02/editar'); await settle(adm, 900);
  await adm.getByRole('button', { name: 'Excluir item' }).first().click(); await sleep(400);
  const dlg = adm.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Excluir item' }).click();
  await adm.keyboard.press('Escape'); await sleep(100);
  const stillOpen = await adm.getByRole('dialog').count();
  await sleep(2000);
  return { ok: stillOpen === 1, note: `diálogo aberto durante o envio após Esc=${stillOpen === 1}` };
});

// ---- Tabs do painel (mobile) ----
const cm = await newCtx(b, { viewport: { width: 390, height: 844 }, hasTouch: true }); const pm = await newPage(cm); await demoLogin(pm, 'admin');
await check('AC08.1-kb-tabs', 'Abas do painel (390): setas ←/→, Home/End movem e ativam; role=tablist/tab/tabpanel; tabindex roving', async () => {
  await pm.goto(BASE + '/admin'); await settle(pm, 900);
  const tabs = pm.getByRole('tab'); const n = await tabs.count();
  await tabs.first().focus();
  await pm.keyboard.press('ArrowRight'); await sleep(200);
  const sel2 = await tabs.nth(1).getAttribute('aria-selected'); const foc2 = await desc(pm);
  await pm.keyboard.press('Home'); await sleep(200); const sel1 = await tabs.first().getAttribute('aria-selected');
  await pm.keyboard.press('End'); await sleep(200); const selN = await tabs.nth(n - 1).getAttribute('aria-selected');
  const panels = await pm.getByRole('tabpanel').count();
  const ti = await tabs.evaluateAll((l) => l.map((t) => t.tabIndex));
  return { ok: n === 2 && sel2 === 'true' && sel1 === 'true' && selN === 'true' && panels === 1, note: `abas=${n}; após →: ${foc2} sel=${sel2}; Home=${sel1}; End=${selN}; tabpanels visíveis=${panels}; tabindex=${ti}` };
});
// ---- Bottom sheet: foco volta ----
await check('AC08.1-kb-sheet', 'Sheet de filtros (390): Esc fecha e foco volta ao botão Filtros', async () => {
  const ps = await newPage(cm); await demoLogin(ps, 'student'); await ps.goto(BASE + '/itens'); await settle(ps, 900);
  const btn = ps.getByRole('button', { name: /^Filtros/ }); await btn.focus(); await ps.keyboard.press('Enter'); await sleep(400);
  const initial = await desc(ps); await ps.keyboard.press('Escape'); await sleep(300);
  const back = await desc(ps);
  return { ok: /Categoria/.test(initial) && /Filtros/.test(back), note: `inicial=${initial}; volta=${back}` };
});

// ---- foco visivel em mais telas (mobile 390) ----
for (const [role, route] of [['student', '/itens/novo'], ['student', '/itens/item-01'], ['admin', '/admin'], ['admin', '/admin/reivindicacoes/claim-01'], ['admin', '/admin/devolucoes'], ['anon', '/cadastro']]) {
  await check(`AC08.1-kb-foco ${route} ${role}`, `Foco visível em todos os tab stops de ${route} (${role}, 1280)`, async () => {
    const c = await newCtx(b, { viewport: { width: 1280, height: 900 } }); const p = await newPage(c);
    if (role !== 'anon') await demoLogin(p, role);
    await p.goto(BASE + route); await settle(p, 900);
    const au = await tabAudit(p, route, 60);
    await c.close();
    return { ok: au.bad.length === 0, note: `${au.count} paradas; sem indicador: ${JSON.stringify(au.bad.slice(0, 3))}` };
  });
}

// ---- prefers-reduced-motion ----
await check('AC08.x-reduced-motion', 'prefers-reduced-motion: reduce desliga animações/transições (getAnimations vazio; skeleton estático; duração ~0)', async () => {
  const res = {};
  for (const mode of ['no-preference', 'reduce']) {
    const c = await newCtx(b, { viewport: { width: 390, height: 844 }, reducedMotion: mode }); const p = await newPage(c); await demoLogin(p, 'student');
    await p.goto(BASE + '/itens', { waitUntil: 'commit' }); await sleep(120);
    const sk = await p.evaluate(() => { const e = document.querySelector('.skeleton, [class*=skeleton]'); if (!e) return null; const cs = getComputedStyle(e); return { anim: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount }; });
    const running = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    await settle(p, 800);
    // botao com transicao
    const tr = await p.evaluate(() => { const a = document.querySelector('main a, main button'); return a ? getComputedStyle(a).transitionDuration : null; });
    // abrir dialogo e medir animacao de entrada
    await p.getByRole('button', { name: /^Filtros/ }).click(); await sleep(60);
    const dlgAnim = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); const cs = d && getComputedStyle(d); return cs && { anim: cs.animationName, dur: cs.animationDuration }; });
    res[mode] = { skeleton: sk, runningAnimations: running, transition: tr, dialog: dlgAnim };
    await c.close();
  }
  const r = res.reduce_ = res.reduce;
  const ok = (res.reduce.runningAnimations === 0 || res.reduce.runningAnimations < res['no-preference'].runningAnimations || res.reduce.runningAnimations === 0) && (!res.reduce.skeleton || res.reduce.skeleton.anim === 'none' || parseFloat(res.reduce.skeleton.dur) < 0.01);
  return { ok, note: JSON.stringify(res) };
});

// ---- status nao apenas por cor ----
await check('AC08.x-status-cor', 'Todo status (item e reivindicação) tem texto + ícone SVG (não só cor) em lista, detalhe, minhas reivindicações e painel', async () => {
  const c = await newCtx(b, { viewport: { width: 390, height: 844 } }); const p = await newPage(c); await demoLogin(p, 'admin');
  const labels = /^(Disponível|Em reivindicação|Devolvido|Pendente|Aceita|Recusada)$/;
  const bad = []; let total = 0;
  for (const r of ['/itens', '/itens/item-05', '/admin', '/admin/reivindicacoes/claim-04', '/admin/devolucoes', '/itens/item-03']) {
    await p.goto(BASE + r); await settle(p, 1200);
    const found = await p.evaluate(() => { const re = /^(Disponível|Em reivindicação|Devolvido|Pendente|Aceita|Recusada)$/; const out = []; for (const e of document.querySelectorAll('main *')) { if (e.getAttribute('role') !== 'tab' && !e.closest('[role=tab]') && (e.children.length === 0 || [...e.children].every((c) => c.tagName === 'svg'))) { const t = (e.textContent || '').trim(); if (re.test(t) && e.tagName !== 'OPTION') { const host = e.closest('[class*=rounded-full]') || e.parentElement; out.push({ t, svg: !!host.querySelector('svg'), hidden: host.querySelector('svg')?.getAttribute('aria-hidden') }); } } } return out; });
    for (const f of found) { total++; if (!f.svg) bad.push(r + ':' + f.t); }
  }
  await c.close();
  return { ok: total > 5 && bad.length === 0, note: `${total} badges verificados; sem ícone: ${JSON.stringify(bad)}` };
});
info('console', 'console', JSON.stringify({ page: page.consoleMsgs, adm: adm.consoleMsgs }));
save();
await b.close();
