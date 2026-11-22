/**
 * Вход dev-сервера (без BENCH_ENTRY): страница выбирается по URL `/<id>/<form>/`, на `/` — список.
 * Только для разработки; замеры идут по отдельным prod-сборкам (scripts/build-entries.mjs).
 */
import manifest from '../../entries.json';

const mains = import.meta.glob('../libs/*/*/main.tsx');
const pages = import.meta.glob('../*/main.tsx');

const [id, form] = location.pathname.split('/').filter(Boolean);
const entry = manifest.entries.find((e) => e.id === id);
const page = manifest.pages.find((p) => p.id === id);

if (entry && form && mains[`../libs/${entry.impl}/${form}/main.tsx`]) {
  void mains[`../libs/${entry.impl}/${form}/main.tsx`]();
} else if (page && pages[`../${page.entry.replace('src/', '')}`]) {
  void pages[`../${page.entry.replace('src/', '')}`]();
} else {
  const root = document.getElementById('root')!;
  const links = manifest.entries.flatMap((e) =>
    manifest.forms
      .filter((f) => mains[`../libs/${e.impl}/${f}/main.tsx`])
      .map((f) => `<li><a href="/${e.id}/${f}/">${e.label} — ${f}</a></li>`)
  );
  for (const p of manifest.pages) links.push(`<li><a href="/${p.id}/">${p.id}</a></li>`);
  root.innerHTML = `<main style="padding:16px;font-family:system-ui"><h1>forms-benchmark</h1><ul>${links.join('')}</ul></main>`;
}
