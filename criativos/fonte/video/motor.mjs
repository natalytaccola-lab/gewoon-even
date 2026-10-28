// Renderiza uma pagina com window.setT(t) em frames e junta com sons (lista de segundos).
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
export async function render(nome, html, dur, sons = [], fps = 30) {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  const pasta = path.join(dir, 'fr-' + nome); fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta);
  const arq = path.join(dir, nome + '.html'); fs.writeFileSync(arq, html);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + arq); await p.waitForTimeout(500);
  for (let i = 0; i < fps * dur; i++) { await p.evaluate(t => setT(t), i / fps); await p.screenshot({ path: path.join(pasta, String(i).padStart(4, '0') + '.png') }); }
  await b.close();
  const ins = sons.map(s => `-i ${s.f}`).join(' ');
  const mix = sons.map((s, i) => `[${i + 1}]adelay=${Math.round(s.t * 1000)}|${Math.round(s.t * 1000)}[s${i}]`).join(';');
  const lab = sons.map((s, i) => `[s${i}]`).join('');
  const som = path.join(dir, nome + '.wav');
  execSync(`ffmpeg -v error -y -f lavfi -t ${dur} -i anullsrc=r=44100:cl=stereo ${ins} -filter_complex "${mix}${mix ? ';' : ''}[0]${lab}amix=inputs=${sons.length + 1}:normalize=0[o]" -map "[o]" -t ${dur} ${som}`, { cwd: dir });
  const out = path.join(dir, `Gewoon Even ${nome} video.mp4`);
  execSync(`ffmpeg -v error -y -framerate ${fps} -i ${pasta}/%04d.png -i ${som} -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 128k -shortest "${out}"`);
  execSync(`ffmpeg -v error -y -i "${out}" -vf "fps=1,scale=216:-1,tile=${dur}x1" -frames:v 1 ${path.join(dir, 'tira-' + nome + '.jpg')}`);
  return out;
}
