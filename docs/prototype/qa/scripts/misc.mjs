// Diversos: requisitos de rede, meta viewport, aria-current, 404, dark mode, sync com marcador. Uso: node misc.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('misc');
const b = await launch();
const settle = async (p, ms = 1300) => { await p.waitForLoadState('networkidle'); await sleep(ms); };

await check('NET-externo', 'Nenhuma requisição a hosts externos (fontes auto-hospedadas, build offline)', async () => {
  const ctx = await newCtx(b); const p = await newPage(ctx); const hosts = new Set(); const fonts = [];
  p.on('request', (r) => { const u = new URL(r.url()); hosts.add(u.host); if (/\.woff2?$/.test(u.pathname)) fonts.push(u.pathname.split('/').pop()); });
  await p.goto(BASE + '/entrar'); await settle(p);
  await demoLogin(p, 'student'); await p.goto(BASE + '/itens'); await settle(p);
  await ctx.close();
  return { ok: [...hosts].every((h) => h === 'localhost:3110'), note: `hosts=${[...hosts]}; fontes=${[...new Set(fonts)].slice(0, 6)}` };
});
await check('A11Y-viewport', 'Meta viewport permite zoom (sem maximum-scale/user-scalable=no)', async () => {
  const ctx = await newCtx(b); const p = await newPage(ctx); await p.goto(BASE + '/entrar');
  const c = await p.evaluate(() => document.querySelector('meta[name=viewport]')?.content);
  await ctx.close();
  return { ok: !/maximum-scale|user-scalable\s*=\s*(no|0)/.test(c || ''), note: c };
});
await check('A11Y-aria-current', 'Navegação marca a página atual com aria-current="page" (header 1280 e bottom nav 390)', async () => {
  const c1 = await newCtx(b, { viewport: { width: 1280, height: 900 } }); const p = await newPage(c1); await demoLogin(p, 'admin');
  const r = {};
  for (const route of ['/admin', '/itens', '/admin/devolucoes']) { await p.goto(BASE + route); await settle(p, 700); r[route] = await p.evaluate(() => [...document.querySelectorAll('[aria-current=page]')].filter((e) => e.offsetParent).map((e) => e.textContent.trim())); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(BASE + '/admin/devolucoes'); await settle(p, 700);
  r.bottom = await p.evaluate(() => [...document.querySelectorAll('nav[aria-label=Principal] [aria-current=page]')].map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
  await c1.close();
  return { ok: r['/admin'][0] === 'Painel' && r['/itens'][0] === 'Itens' && r['/admin/devolucoes'][0] === 'Devoluções' && r.bottom[0] === 'Devoluções', note: JSON.stringify(r) };
});
await check('A11Y-404', '404: página própria do app (pt-BR, identidade, caminho de volta) — registra o que aparece', async () => {
  const c = await newCtx(b, { viewport: { width: 390, height: 844 } }); const p = await newPage(c);
  await p.goto(BASE + '/rota-inexistente'); await settle(p, 500);
  const t = await p.locator('body').innerText(); const lang = await p.evaluate(() => document.documentElement.lang);
  await p.screenshot({ path: OUT + '/defeito-404-390.png' });
  const links = await p.locator('a').allInnerTexts();
  await c.close();
  return { ok: /não encontrada|Página não/i.test(t) && links.length > 0, note: `texto="${t.replace(/\n+/g, ' ')}"; lang=${lang}; links=${JSON.stringify(links)}` };
});
await check('A11Y-dark', 'Modo escuro do SO: o app permanece legível (design é só tema claro)', async () => {
  const c = await newCtx(b, { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const p = await newPage(c); await demoLogin(p, 'student'); await settle(p, 800);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.screenshot({ path: OUT + '/dark-itens-390.png' });
  await c.close();
  return { ok: /246, 244, 239/.test(bg), note: 'body bg=' + bg };
});
await check('A11Y-titulo-negado', 'Título da aba em "Acesso restrito" reflete a situação', async () => {
  const c = await newCtx(b); const p = await newPage(c); await demoLogin(p, 'student'); await p.goto(BASE + '/admin'); await settle(p, 800);
  const t = await p.title(); await c.close();
  return { ok: /restrito|negado/i.test(t), note: 'document.title=' + t };
});
await check('AC04.8-sync-sem-reload', 'Sync entre abas SEM recarregar (marcador window.__m preservado) — admin aceita, aluna vê "Aceita"', async () => {
  const c = await newCtx(b, { viewport: { width: 390, height: 844 } });
  const m = await newPage(c); await demoLogin(m, 'student'); await m.goto(BASE + '/minhas-reivindicacoes'); await settle(m, 800);
  await m.evaluate(() => { window.__m = 'vivo'; });
  const a = await newPage(c); await a.setViewportSize({ width: 1280, height: 900 }); await demoLogin(a, 'admin');
  await a.goto(BASE + '/admin/reivindicacoes/claim-06'); await settle(a, 700);
  await a.getByRole('button', { name: 'Aceitar', exact: true }).click(); await a.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click(); await sleep(1800);
  const marker = await m.evaluate(() => window.__m); const t = await m.locator('li', { hasText: 'Calculadora científica' }).innerText();
  // e o detalhe do item aberto em uma terceira aba
  await c.close();
  return { ok: marker === 'vivo' && /Aceita/.test(t), note: `marcador=${marker}; card="${t.replace(/\n+/g, ' ').slice(0, 80)}"` };
});
await check('AC04.8-sync-detalhe-admin', 'Detalhe do item aberto (admin) reflete decisão feita em outra aba sem recarregar', async () => {
  const c = await newCtx(b, { viewport: { width: 1280, height: 900 } });
  const d = await newPage(c); await demoLogin(d, 'admin'); await d.goto(BASE + '/itens/item-03'); await settle(d, 800);
  await d.evaluate(() => { window.__m = 'vivo'; });
  const a2 = await newPage(c); await demoLogin(a2, 'admin'); await a2.goto(BASE + '/admin/reivindicacoes/claim-01'); await settle(a2, 700);
  await a2.getByRole('button', { name: 'Aceitar', exact: true }).click(); await a2.getByRole('dialog').getByRole('button', { name: 'Aceitar reivindicação' }).click(); await sleep(1800);
  const marker = await d.evaluate(() => window.__m); const t = await d.locator('main').innerText();
  await c.close();
  return { ok: marker === 'vivo' && /Registrar devolução/.test(t) && /Aceita/.test(t), note: `marcador=${marker}; tem "Registrar devolução"=${/Registrar devolução/.test(t)}` };
});
save();
await b.close();
