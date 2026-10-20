import { launch, newCtx, newPage, BASE, sleep } from './lib.mjs';
const clip=(s,n=160)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const browser = await launch();
for (const W of [360, 390]) {
  const ctx = await newCtx(browser, { viewport: { width: W, height: 844 } });
  const p = await newPage(ctx);
  await p.goto(BASE + '/entrar'); await p.waitForLoadState('networkidle');
  const ban = await p.locator('aside[aria-label="Aviso de demonstração"]').first().boundingBox();
  console.log(`[${W}] faixa de demo: altura=${ban && Math.round(ban.height)}px topo=${ban && Math.round(ban.y)}`);
  await p.getByRole('button', { name: /Aluno demo/ }).click(); await p.waitForURL(/\/itens/); await p.waitForLoadState('networkidle'); await sleep(800);
  const ban2 = await p.locator('aside[aria-label="Aviso de demonstração"]').first().boundingBox();
  const hdr = await p.locator('header').first().boundingBox();
  console.log(`[${W}] logado: faixa=${ban2 && Math.round(ban2.height)}px header y=${hdr && Math.round(hdr.y)} h=${hdr && Math.round(hdr.height)}`);
  if (W === 390) {
    // foco após navegação client-side
    await p.locator('a[href="/itens/item-01"]').first().click(); await p.waitForURL(/item-01/); await sleep(900);
    console.log('[390] foco após navegação (lista→detalhe):', await p.evaluate(()=>{const a=document.activeElement;return a?`${a.tagName}#${a.id||''}.${(a.className||'').toString().slice(0,30)}`:'null'}));
    console.log('[390] link "pular" presente:', await p.getByRole('link', { name: /Pular para o conteúdo/ }).count());
    // voltar com busca
    await p.goto(BASE + '/itens?categoria=Chaves'); await p.waitForLoadState('networkidle'); await sleep(900);
    await p.locator('a[href^="/itens/item-"]').first().click(); await p.waitForURL(/\/itens\/item-/); await sleep(900);
    const back = p.locator('header a, header button').filter({ hasText: /Voltar|Itens/ }).first();
    const labels = await p.locator('header a, header button').evaluateAll(els=>els.map(e=>(e.getAttribute('aria-label')||e.innerText||'').replace(/\s+/g,' ').trim().slice(0,40)));
    console.log('[390] header (detalhe):', JSON.stringify(labels));
    const bk = p.getByRole('link', { name: /Voltar/ }).first();
    console.log('[390] link Voltar href:', await bk.getAttribute('href').catch(()=>'ausente'));
    // Minhas reivindicações -> Ver item -> voltar
    await p.goto(BASE + '/minhas-reivindicacoes'); await p.waitForLoadState('networkidle'); await sleep(900);
    await p.getByRole('link', { name: /Ver item/ }).first().click(); await p.waitForURL(/\/itens\/item-/); await sleep(700);
    console.log('[390] Ver item → voltar href:', await p.getByRole('link', { name: /Voltar/ }).first().getAttribute('href').catch(()=>'ausente'));
  }
  await ctx.close();
}
await browser.close();
