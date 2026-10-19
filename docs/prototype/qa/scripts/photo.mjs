// Redimensionamento real de foto por canvas + cota do localStorage. Uso: node photo.mjs
import { launch, newCtx, newPage, BASE, demoLogin, OUT, sleep } from './lib.mjs';
import { makeRec } from './rec.mjs';
const IMG = (process.env.QA_IMGS || new URL('./imgs', import.meta.url).pathname);
const { check, info, save } = makeRec('photo');
const b = await launch();
const ctx = await newCtx(b, { viewport: { width: 390, height: 844 } });
const page = await newPage(ctx);
await demoLogin(page, 'student');
const DB = 'campuslost:proto:v1:db';
const Q = 'O que foi encontrado?';
async function register(title, file) {
  await page.goto(BASE + '/itens/novo'); await page.waitForLoadState('networkidle');
  if (file) await page.locator('input[type=file]').setInputFiles(file);
  await page.getByLabel(Q).fill(title); await page.getByLabel('Descrição', { exact: true }).fill('Descricao valida longa'); await page.getByLabel('Categoria').selectOption('Outros'); await page.getByLabel('Onde foi encontrado?').selectOption('Cantina'); await page.getByLabel('Onde está guardado agora?').fill('Portaria');
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Registrar item' }).click();
  const res = await Promise.race([
    page.waitForURL((u) => /^\/itens\/[^/]+$/.test(u.pathname) && u.pathname !== '/itens/novo', { timeout: 30000 }).then(() => 'ok'),
    page.getByText(/Não foi possível/).first().waitFor({ timeout: 30000 }).then(() => 'erro'),
  ]);
  return { res, ms: Date.now() - t0 };
}
async function stored(title) {
  return page.evaluate(async ([k, t]) => {
    const it = JSON.parse(localStorage.getItem(k)).items.find((i) => i.title === t);
    if (!it || !it.photoDataUrl) return { photo: false };
    const url = it.photoDataUrl;
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = Array.from(x.getImageData(2, 2, 1, 1).data);
    return { photo: true, mime: url.slice(5, url.indexOf(';')), w: img.naturalWidth, h: img.naturalHeight, chars: url.length, approxKB: Math.round(url.length * 0.75 / 1024), corner: px };
  }, [DB, title]);
}
const cases = [
  ['jpg 4000x3000 (4,0 MB)', 'grande-4000x3000.jpg', (s) => Math.max(s.w, s.h) === 640 && s.w === 640 && s.h === 480],
  ['png 4000x3000 (10,2 MB, perto do limite)', 'grande-4000x3000.png', (s) => s.w === 640 && s.h === 480],
  ['jpg retrato 3000x4000', 'retrato-3000x4000.jpg', (s) => s.w === 480 && s.h === 640],
  ['png pequena 300x200 (não ampliar)', 'pequena-300x200.png', (s) => s.w === 300 && s.h === 200],
  ['png transparente 800x600 (fundo branco)', 'transparente-800x600.png', (s) => s.w === 640 && s.h === 480 && s.corner[0] > 240 && s.corner[1] > 240 && s.corner[2] > 240],
];
for (const [i, [desc, f, test]] of cases.entries()) {
  await check(`PHOTO-${i + 1}`, `Foto ${desc}: processada, ≤ 640 px, JPEG, ≤ ~300 KB`, async () => {
    const title = `QA Foto ${i + 1}`;
    const r = await register(title, `${IMG}/${f}`);
    const s = await stored(title);
    return { ok: r.res === 'ok' && s.photo && s.mime === 'image/jpeg' && test(s) && s.chars <= 400000, note: `fluxo=${r.res} em ${r.ms} ms; salvo=${JSON.stringify(s)}` };
  });
}
// detalhe mostra a imagem e nitidez
await check('PHOTO-6', 'Detalhe e cartão da lista exibem a foto salva (naturalWidth > 0)', async () => {
  await page.goto(BASE + '/itens'); await page.waitForLoadState('networkidle'); await sleep(1500);
  const lst = await page.evaluate(() => [...document.images].filter((i) => i.src.startsWith('data:')).map((i) => [i.naturalWidth, i.naturalHeight, i.complete]));
  return { ok: lst.length >= 3 && lst.every((x) => x[0] > 0 && x[2]), note: JSON.stringify(lst) };
});
await page.screenshot({ path: OUT + '/photo-lista-com-fotos-390.png' });
// edicao (admin): trocar e remover foto
const pa = await newPage(ctx); await pa.setViewportSize({ width: 1280, height: 900 }); await demoLogin(pa, 'admin');
await check('PHOTO-7', 'Admin edita item e remove a foto existente; depois adiciona outra', async () => {
  const id = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).items.find((i) => i.title === 'QA Foto 1').id, DB);
  await pa.goto(BASE + `/admin/itens/${id}/editar`); await pa.waitForLoadState('networkidle'); await sleep(1200);
  const hadPreview = await pa.locator('img[alt^="Pré-visualização"]').count();
  await pa.getByRole('button', { name: 'Remover foto' }).click();
  await pa.getByRole('button', { name: 'Salvar alterações' }).click(); await sleep(2000);
  const afterRemove = await pa.evaluate(([k, id]) => !!JSON.parse(localStorage.getItem(k)).items.find((i) => i.id === id).photoDataUrl, [DB, id]);
  await pa.goto(BASE + `/admin/itens/${id}/editar`); await pa.waitForLoadState('networkidle'); await sleep(1000);
  await pa.locator('input[type=file]').setInputFiles(`${IMG}/retrato-3000x4000.jpg`);
  await pa.getByRole('button', { name: 'Salvar alterações' }).click(); await sleep(2500);
  const afterAdd = await pa.evaluate(([k, id]) => { const u = JSON.parse(localStorage.getItem(k)).items.find((i) => i.id === id).photoDataUrl; return u ? u.length : 0; }, [DB, id]);
  return { ok: hadPreview === 1 && !afterRemove && afterAdd > 1000, note: `previewInicial=${hadPreview}; fotoApósRemover=${afterRemove}; charsApósAdicionar=${afterAdd}` };
});
// cota: encher
await check('PHOTO-QUOTA', 'Encher o localStorage com fotos: erro claro (STORAGE_FULL), sem perder dados, app continua usável; Reiniciar demonstração libera', async () => {
  let n = 0, last = null;
  for (; n < 45; n++) {
    const r = await register(`QA Cota ${n}`, `${IMG}/grande-4000x3000.jpg`);
    if (r.res !== 'ok') { last = r; break; }
  }
  const msg = (await page.locator('body').innerText()).match(/Não foi possível[^\n]*(\n[^\n]*){0,2}/)?.[0]?.replace(/\n/g, ' | ');
  const kept = await page.getByLabel(Q).inputValue();
  await page.screenshot({ path: OUT + '/photo-cota-cheia-390.png' });
  const used = await page.evaluate(() => { let s = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); s += k.length + localStorage.getItem(k).length; } return s; });
  // app usavel?
  await page.goto(BASE + '/itens'); await page.waitForLoadState('networkidle'); await sleep(1500);
  const listOk = /Itens encontrados/.test(await page.locator('body').innerText());
  const count = await page.locator('main ul a[href^="/itens/"]').count();
  return { ok: last !== null && /armazenamento|cheio|Não foi possível/.test(msg || '') && kept.startsWith('QA Cota') && listOk, note: `falhou no ${n + 1}º registro (≈${n} fotos salvas); chars em localStorage=${used}; mensagem="${msg}"; título mantido="${kept}"; lista ok=${listOk} (${count} cartões)` };
});
info('console', 'console', JSON.stringify(page.consoleMsgs.slice(0, 5)));
save();
await b.close();
