// Alvos de toque (inclui links inline) e barras fixas/sticky. Uso: node touch.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('touch');
const b = await launch();
const PLAN = {
  anon: ['/entrar', '/cadastro'],
  student: ['/itens', '/itens/item-01', '/itens/item-07', '/itens/novo', '/itens/item-01/reivindicar', '/minhas-reivindicacoes'],
  admin: ['/admin', '/admin/reivindicacoes/claim-01', '/admin/reivindicacoes/claim-04', '/admin/itens/item-01/editar', '/admin/devolucoes', '/itens/item-05'],
};
const SEL = 'a[href], button, input:not([type=hidden]):not([type=file]), select, textarea, [role=menuitem], [role=tab]';
const all = [];
for (const w of [360, 390]) {
  for (const role of Object.keys(PLAN)) {
    const ctx = await newCtx(b, { viewport: { width: w, height: 780 }, hasTouch: true }); const page = await newPage(ctx);
    if (role !== 'anon') await demoLogin(page, role);
    for (const r of PLAN[role]) {
      await page.goto(BASE + r); await page.waitForLoadState('networkidle'); await sleep(1300);
      const small = await page.evaluate((sel) => {
        const out = [];
        for (const e of document.querySelectorAll(sel)) {
          const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || e.closest('[hidden],[aria-hidden=true]')) continue;
          if (e.matches('a.sr-only, a[href="#conteudo"]')) continue;
          let box = e; if ((e.type === 'radio' || e.type === 'checkbox') && e.closest('label')) box = e.closest('label');
          const r = box.getBoundingClientRect(); if (!r.width || !r.height) continue;
          if (r.height < 43.5 || r.width < 43.5) out.push({ el: e.tagName.toLowerCase() + '[' + ((e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 30)) + ']', w: Math.round(r.width), h: Math.round(r.height), display: cs.display, inP: !!e.closest('p') });
        }
        return out;
      }, SEL);
      for (const s of small) all.push({ w, role, route: r, ...s });
    }
    await ctx.close();
  }
}
const grouped = {};
for (const s of all) { const k = `${s.el} ${s.w}x${s.h}`; (grouped[k] ??= new Set()).add(`${s.role}${s.route}@${s.w}`); }
for (const [k, v] of Object.entries(grouped)) console.log(k, '::', [...v].slice(0, 4).join(', '), v.size > 4 ? `(+${v.size - 4})` : '');
console.log('total de alvos < 44 px (únicos):', Object.keys(grouped).length);

// ---- barras fixas/sticky: cobertura do fim do conteudo e foco ----
for (const [role, route] of [['student', '/itens'], ['student', '/itens/novo'], ['student', '/itens/item-01'], ['student', '/itens/item-01/reivindicar'], ['student', '/minhas-reivindicacoes'], ['admin', '/admin'], ['admin', '/admin/reivindicacoes/claim-01'], ['admin', '/admin/reivindicacoes/claim-04'], ['admin', '/admin/itens/item-01/editar'], ['admin', '/admin/devolucoes'], ['admin', '/itens/item-05']]) {
  for (const w of [320, 360, 390]) {
    await check(`BAR ${route} ${role} ${w}`, `Barra inferior não cobre conteúdo/foco: ${route} (${role}) a ${w} px`, async () => {
      const ctx = await newCtx(b, { viewport: { width: w, height: 700 }, hasTouch: true }); const page = await newPage(ctx);
      await demoLogin(page, role); await page.goto(BASE + route); await page.waitForLoadState('networkidle'); await sleep(1300);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
      const r = await page.evaluate(() => {
        const vh = innerHeight;
        const bars = [...document.querySelectorAll('[data-actionbar] > div, nav[data-bottomnav]')].filter((e) => e.getBoundingClientRect().height > 0);
        const barTop = bars.length ? Math.min(...bars.map((e) => e.getBoundingClientRect().top)) : vh;
        let lastBottom = 0, lastEl = '';
        for (const e of document.querySelectorAll('main *')) { if (e.children.length) continue; if (bars.some((b) => b.contains(e))) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue; const rr = e.getBoundingClientRect(); if (!rr.height) continue; if (rr.bottom > lastBottom) { lastBottom = rr.bottom; lastEl = e.tagName + ':' + (e.textContent || '').trim().slice(0, 25); } }
        const atBottom = Math.abs(window.scrollY + vh - document.documentElement.scrollHeight) < 3;
        return { hasBar: bars.length > 0, barTop: Math.round(barTop), lastBottom: Math.round(lastBottom), lastEl, atBottom, covered: bars.length > 0 && lastBottom > barTop + 0.5 };
      });
      // foco: o ultimo elemento focavel do conteudo fica visivel acima da barra?
      const f = await page.evaluate(() => {
        const bars = [...document.querySelectorAll('[data-actionbar] > div, nav[data-bottomnav]')];
        const barTop = bars.length ? Math.min(...bars.map((e) => e.getBoundingClientRect().top)) : innerHeight;
        const fo = [...document.querySelectorAll('main a[href], main button, main input:not([type=hidden]), main select, main textarea')].filter((e) => !bars.some((b) => b.contains(e)) && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden');
        const last = fo[fo.length - 1]; if (!last) return null; last.scrollIntoView({ block: 'nearest' }); last.focus({ preventScroll: false });
        const rr = last.getBoundingClientRect(); return { el: last.tagName + ':' + (last.getAttribute('aria-label') || last.textContent || last.id || '').trim().slice(0, 20), bottom: Math.round(rr.bottom), barTop: Math.round(barTop), hidden: rr.bottom > barTop + 0.5 };
      });
      if (route === '/itens/novo' || route === '/admin' || route === '/admin/reivindicacoes/claim-01') await page.screenshot({ path: `${OUT}/bar-${role}${route.replace(/\//g, '_')}-${w}.png` });
      await ctx.close();
      return { ok: !r.covered && !(f && f.hidden), note: JSON.stringify({ ...r, focoUltimo: f }) };
    });
  }
}
save();
await b.close();
