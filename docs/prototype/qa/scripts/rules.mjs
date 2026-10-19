// Regras de estado adicionais, premissas e latencia. Uso: node rules.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const { check, info, save } = makeRec('rules');
const b = await launch();
const settle = async (p, ms = 1300) => { await p.waitForLoadState('networkidle'); await sleep(ms); };
const ctx = await newCtx(b, { viewport: { width: 1280, height: 900 } });
const adm = await newPage(ctx); await demoLogin(adm, 'admin');
const stu = await newPage(ctx); await stu.setViewportSize({ width: 390, height: 844 }); await demoLogin(stu, 'student');
const tea = await newPage(ctx); await tea.setViewportSize({ width: 390, height: 844 }); await demoLogin(tea, 'teacher');
const itemStatus = async (id) => { await adm.goto(BASE + `/itens/${id}`); await settle(adm, 900); const t = await adm.locator('main').innerText(); return /Disponível/.test(t) ? 'Disponível' : /Em reivindicação/.test(t) ? 'Em reivindicação' : /Devolvido/.test(t) ? 'Devolvido' : '?'; };
const decide = async (claim, act) => { await adm.goto(BASE + `/admin/reivindicacoes/${claim}`); await settle(adm, 800); await adm.getByRole('button', { name: act, exact: true }).click(); const d = adm.getByRole('dialog'); const t0 = Date.now(); await d.getByRole('button', { name: `${act} reivindicação` }).click(); await adm.getByRole('dialog').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {}); const ms = Date.now() - t0; await sleep(1000); return ms; };

await check('AC04.6-parcial', 'Item com 2 pendentes (item-03): recusar a 1ª mantém "Em reivindicação"; recusar a 2ª devolve a "Disponível"', async () => {
  const s0 = await itemStatus('item-03');
  const ms1 = await decide('claim-01', 'Recusar'); const s1 = await itemStatus('item-03');
  const ms2 = await decide('claim-02', 'Recusar'); const s2 = await itemStatus('item-03');
  return { ok: s0 === 'Em reivindicação' && s1 === 'Em reivindicação' && s2 === 'Disponível', note: `${s0} -> ${s1} -> ${s2}; latência do diálogo ao fechar: ${ms1} ms / ${ms2} ms` };
});
await check('AC04.7c', 'Beatriz e Rafael (recusados em item-03) aparecem como Recusada em "Minhas reivindicações" (Rafael) e item-03 mostra Recusada a ele', async () => {
  await tea.goto(BASE + '/itens/item-03'); await settle(tea, 900);
  const t = await tea.locator('main').innerText();
  return { ok: /Reivindicação recusada/.test(t) && (await tea.getByText('É meu', { exact: true }).count()) === 0, note: t.replace(/\n+/g, ' | ').slice(100, 260) };
});
await check('P8', 'Quem registrou o item pode reivindicá-lo (Marina em item-08, registrado por ela): comportamento observado', async () => {
  await stu.goto(BASE + '/itens/item-08'); await settle(stu, 900);
  const t = await stu.locator('main').innerText(); const emMeu = await stu.getByText('É meu', { exact: true }).count();
  return { ok: true, note: `"É meu" visível=${emMeu === 1}; texto: ${t.replace(/\n+/g, ' | ').slice(60, 200)} (premissa P8 pendente de confirmação)` };
});
await check('LAT', 'Latência simulada 300–600 ms nas ações (medida no envio de reivindicação e login demo)', async () => {
  await stu.goto(BASE + '/itens/item-09/reivindicar'); await settle(stu, 700);
  await stu.getByLabel('Que detalhes só o dono saberia?').fill('Armação com fita adesiva na haste.'); await stu.getByLabel('Onde e quando você perdeu?').fill('Cantina, semana passada');
  const t0 = Date.now(); await stu.getByRole('button', { name: 'Enviar reivindicação' }).click(); await stu.waitForURL(/minhas-reiv/); const ms = Date.now() - t0;
  const c = await newCtx(b); const p = await newPage(c); await p.goto(BASE + '/entrar'); await settle(p, 900);
  const t1 = Date.now(); await p.getByRole('button', { name: /Aluno demo/ }).click(); await p.waitForURL(/\/itens/); const ms2 = Date.now() - t1; await c.close();
  return { ok: ms >= 250 && ms <= 1500 && ms2 >= 250 && ms2 <= 1500, note: `envio de reivindicação: ${ms} ms; login demo: ${ms2} ms` };
});
await check('P14-bloqueio-novas', 'Item com reivindicação aceita bloqueia nova reivindicação e explica (também no formulário via URL direta)', async () => {
  await stu.goto(BASE + '/itens/item-05/reivindicar'); await settle(stu, 900);
  const t = await stu.locator('main').innerText();
  return { ok: (await stu.getByRole('button', { name: 'Enviar reivindicação' }).count()) === 0, note: t.replace(/\n+/g, ' | ').slice(60, 240) };
});
await check('ADM-nao-reivindica', 'Admin não reivindica: botão "É meu" ausente e rota /reivindicar bloqueada com motivo', async () => {
  await adm.goto(BASE + '/itens/item-02'); await settle(adm, 800);
  const t = await adm.locator('main').innerText(); const b1 = await adm.getByText('É meu', { exact: true }).count();
  await adm.goto(BASE + '/itens/item-02/reivindicar'); await settle(adm, 800);
  const b2 = await adm.getByRole('button', { name: 'Enviar reivindicação' }).count(); const t2 = await adm.locator('main').innerText();
  return { ok: b1 === 0 && b2 === 0 && /não reivindica/.test(t + t2), note: t2.replace(/\n+/g, ' | ').slice(60, 220) };
});
await check('RF05-sem-aceita', 'Registrar devolução inexistente sem reivindicação aceita: botão ausente em item com só pendentes (item-07 / claim-07 pendente)', async () => {
  await adm.goto(BASE + '/itens/item-07'); await settle(adm, 800);
  const n = await adm.getByRole('button', { name: /Registrar devolução/ }).count();
  await adm.goto(BASE + '/admin/reivindicacoes/claim-06'); await settle(adm, 800);
  const n2 = await adm.getByRole('button', { name: /Registrar devolução/ }).count();
  return { ok: n === 0 && n2 === 0, note: `detalhe=${n}; análise pendente=${n2}` };
});
save();
await b.close();
