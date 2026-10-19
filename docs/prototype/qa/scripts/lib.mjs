import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const BASE = process.env.QA_BASE || 'http://localhost:3110';
export const EXE = process.env.QA_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const OUT = process.env.QA_OUT || '/tmp/qa-out';
fs.mkdirSync(OUT, { recursive: true });
export const AXE_SRC = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

export async function launch() {
  return chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-background-networking', '--disable-features=AutofillServerCommunication,OptimizationHints,Translate', '--disable-component-update', '--no-default-browser-check'], headless: true });
}
export async function newCtx(browser, opts = {}) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Fortaleza', ...opts });
}
export async function newPage(ctx) {
  const page = await ctx.newPage();
  page.consoleMsgs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) page.consoleMsgs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.consoleMsgs.push('pageerror: ' + e.message));
  return page;
}
/** role: student | teacher | admin */
export async function demoLogin(page, role) {
  await page.goto(BASE + '/entrar');
  const name = { student: /Aluno demo/, teacher: /Professor demo/, admin: /Administração demo/ }[role];
  await page.getByRole('button', { name }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}
export async function axe(page, label, opts = {}) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(async (o) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, ...o });
    return r.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
      nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' | ') })),
    }));
  }, opts);
  return { label, violations: res };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
