// Responsividade: overflow horizontal, alvos de toque, barras fixas. Uso: node responsive.mjs [seed|stress]
import fs from 'node:fs';
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
const STATE = process.argv[2] || 'seed';
const WIDTHS = [320, 360, 390, 768, 1280];
const DB = 'campuslost:proto:v1:db';
const PLAN = {
  anon: ['/entrar', '/cadastro', '/rota-inexistente'],
  student: ['/itens', '/itens/item-01', '/itens/item-03', '/itens/item-05', '/itens/item-10', '/itens/novo', '/itens/item-01/reivindicar', '/minhas-reivindicacoes', '/admin'],
  admin: ['/admin', '/admin/reivindicacoes/claim-01', '/admin/reivindicacoes/claim-04', '/admin/itens/item-01/editar', '/admin/devolucoes', '/itens', '/itens/item-03', '/itens/item-05', '/itens/item-10', '/itens/item-01/reivindicar', '/minhas-reivindicacoes'],
};
const results = [];
const b = await launch();

async function stress(page) {
  await page.evaluate((k) => {
    const db = JSON.parse(localStorage.getItem(k));
    const it = (id) => db.items.find((i) => i.id === id);
    it('item-01').title = 'A'.repeat(80); it('item-01').description = 'B'.repeat(500); it('item-01').storedAt = 'C'.repeat(120);
    it('item-03').title = 'Chaveiro muito longo com bastante texto para quebrar em varias linhas no cartao 123456789';
    it('item-10').title = 'M'.repeat(80);
    const u = db.users.find((x) => x.id === 'user-beatriz'); u.name = 'Beatriz' + 'N'.repeat(73); u.email = 'e'.repeat(100) + '@demo.test';
    const c = db.claims.find((x) => x.id === 'claim-01'); c.proofDetails = 'P'.repeat(500); c.lostWhereWhen = 'L'.repeat(300);
    localStorage.setItem(k, JSON.stringify(db));
  }, DB);
}

async function measure(page) {
  return page.evaluate(() => {
    const vw = innerWidth;
    const over = [];
    for (const e of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1 && !e.closest('[class*="sr-only"]')) {
        // ignora filhos de contêiner com rolagem interna
        let p = e.parentElement, inScroller = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden') && p.getBoundingClientRect().right <= vw + 1) { inScroller = true; break; } p = p.parentElement; }
        if (!inScroller) over.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 3).join('.')}[${(e.textContent || '').trim().slice(0, 18)}] right=${Math.round(r.right)}`);
      }
    }
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=menuitem], [role=tab], summary';
    const small = [];
    for (const e of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.closest('[hidden],[aria-hidden=true]')) continue;
      let r = e.getBoundingClientRect();
      // radio/checkbox sr-only: mede o rotulo que o contem
      if ((e.type === 'radio' || e.type === 'checkbox') && e.closest('label')) r = e.closest('label').getBoundingClientRect();
      if (e.type === 'file') continue;
      if (r.width === 0 || r.height === 0) continue;
      const inline = e.tagName === 'A' && e.closest('p, li, span') && getComputedStyle(e).display === 'inline';
      if (r.height < 43.5 || r.width < 43.5) small.push({ el: `${e.tagName.toLowerCase()}[${(e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 28)}]`, w: Math.round(r.width), h: Math.round(r.height), inline: !!inline });
    }
    // barras fixas
    const fixed = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.position === 'fixed' && r.width > 0 && r.height > 0 && !e.closest('dialog') && e.getAttribute('role') !== 'status' && e.getAttribute('role') !== 'alert' && !(e.className + '').includes('sr-only'); }).map((e) => { const r = e.getBoundingClientRect(); return { cls: String(e.className).slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), tag: e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : '') }; });
    return { vw, sw: document.documentElement.scrollWidth, bodySw: document.body.scrollWidth, over: over.slice(0, 5), small, fixed };
  });
}
async function coverCheck(page) {
  // rola ao fim e confere se o ultimo conteudo fica acima da barra fixa inferior
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(250);
  return page.evaluate(() => {
    const vh = innerHeight;
    const bars = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.position === 'fixed' && r.width > 100 && r.height > 20 && r.bottom >= vh - 2 && r.top > vh / 2 && !e.closest('dialog') && e.getAttribute('role') !== 'status' && e.getAttribute('role') !== 'alert'; });
    if (!bars.length) return { bar: false };
    const top = Math.min(...bars.map((e) => e.getBoundingClientRect().top));
    // ultimo elemento de conteudo (nao fixo, nao dentro de barra) visivel
    let lastBottom = 0, lastDesc = '';
    const walker = document.querySelectorAll('main *, footer *');
    for (const e of walker) { const cs = getComputedStyle(e); if (cs.position === 'fixed' || bars.some((b) => b.contains(e))) continue; const r = e.getBoundingClientRect(); if (r.height === 0 || r.width === 0) continue; if (e.children.length && !(e.textContent || '').trim()) continue; if (r.bottom > lastBottom && r.bottom <= document.documentElement.scrollHeight) { lastBottom = r.bottom; lastDesc = e.tagName + ':' + (e.textContent || '').trim().slice(0, 20); } }
    // elementos de texto/controle: usar apenas folhas
    let leafBottom = 0, leaf = '';
    for (const e of document.querySelectorAll('main *, footer *')) { if (e.children.length) continue; const r = e.getBoundingClientRect(); if (r.height === 0) continue; if (bars.some((b) => b.contains(e))) continue; if (r.bottom > leafBottom) { leafBottom = r.bottom; leaf = e.tagName + ':' + (e.textContent || '').trim().slice(0, 24); } }
    return { bar: true, barTop: Math.round(top), leafBottom: Math.round(leafBottom), leaf, covered: leafBottom > top + 1 };
  });
}

for (const role of Object.keys(PLAN)) {
  for (const w of WIDTHS) {
    const ctx = await newCtx(b, { viewport: { width: w, height: 800 }, hasTouch: w < 768 });
    const page = await newPage(ctx);
    if (role !== 'anon') {
      await demoLogin(page, role);
      if (STATE === 'stress') await stress(page);
    }
    for (const route of PLAN[role]) {
      await page.goto(BASE + route); await page.waitForLoadState('networkidle'); await sleep(1400);
      const m = await measure(page);
      const cov = await coverCheck(page);
      const r = { state: STATE, role, w, route, final: new URL(page.url()).pathname, sw: m.sw, over: m.over, smallN: m.small.filter((s) => !s.inline).length, small: m.small.filter((s) => !s.inline).slice(0, 8), fixed: m.fixed.map((f) => f.tag + ':' + f.h), cov };
      results.push(r);
      const flag = (m.sw > m.vw ? 'OVERFLOW ' : '') + (cov.covered ? 'COBERTO ' : '') + (r.smallN ? `alvos<44:${r.smallN} ` : '');
      console.log(`${STATE} ${role.padEnd(7)} ${String(w).padStart(4)} ${route.padEnd(32)} sw=${m.sw}/${m.vw} ${flag}`);
      if (m.sw > m.vw) console.log('     overflow:', JSON.stringify(m.over));
    }
    await ctx.close();
  }
}
fs.writeFileSync(`${OUT}/responsive-${STATE}.json`, JSON.stringify(results, null, 1));
await b.close();
