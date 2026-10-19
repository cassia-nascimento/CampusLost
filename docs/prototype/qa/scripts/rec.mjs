import fs from 'node:fs';
import { OUT } from './lib.mjs';

export function makeRec(name) {
  const results = [];
  const file = `${OUT}/${name}.json`;
  async function check(id, desc, fn) {
    if (process.env.ONLY && !new RegExp(process.env.ONLY).test(id)) return;
    try {
      const r = await fn();
      const ok = r === undefined ? true : (typeof r === 'object' && r !== null && 'ok' in r ? r.ok : !!r);
      const note = r && typeof r === 'object' && 'note' in r ? r.note : '';
      results.push({ id, desc, ok, note });
      console.log(`${ok ? 'OK   ' : 'FALHA'} ${id} ${desc}${note ? ' :: ' + note : ''}`);
    } catch (e) {
      results.push({ id, desc, ok: false, note: 'EXCECAO: ' + String(e.message).split('\n')[0] });
      console.log(`FALHA ${id} ${desc} :: EXCECAO ${String(e.message).split('\n').slice(0, 2).join(' ')}`);
    }
  }
  function info(id, desc, note) {
    results.push({ id, desc, ok: null, note });
    console.log(`INFO  ${id} ${desc} :: ${note}`);
  }
  function save() { fs.writeFileSync(file, JSON.stringify(results, null, 1)); }
  return { check, info, save, results };
}
