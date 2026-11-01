/**
 * Сводка прогона калибровки: `metrics.json` (детерминированные числа — для сравнения с baseline,
 * без времени и путей) и `report.md` (то же — для чтения).
 */

const pct = (x) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : `${Math.round(x * 1000) / 10}%`;
const frac = (r) => (r ? `${r.hit}/${r.total}` : '—');

export function buildMetrics({ smoke, t1, t2, t3, t4, t5, t6 }) {
  const m = {};
  if (t3) {
    m.t3 = Object.fromEntries(
      Object.entries(t3.byProject).map(([p, s]) => [p, `${s.passed}/${s.total}`])
    );
  }
  if (smoke) {
    m.smoke = {
      pass: smoke.filter((c) => c.status === 'pass').length,
      fail: smoke.filter((c) => c.status === 'fail').map((c) => `${c.id}/${c.channel}`),
      info: smoke.filter((c) => c.status === 'info').length,
    };
  }
  if (t1) {
    m.t1 = {};
    for (const [id, e] of Object.entries(t1)) {
      const node = e.channels.node ?? e.channels.worker;
      const s = node?.score;
      m.t1[id] = {
        counts: node?.counts,
        parity: e.parity ?? null,
        ...(s
          ? {
              fields: frac(s.fields),
              fieldsExtra: s.fields.extra.length,
              typeMismatch: s.fields.typeMismatch.length,
              componentMismatch: s.fields.componentMismatch.length,
              steps: `${s.steps.actual}/${s.steps.expected}`,
              placement: frac(s.steps.placement),
              arrays: frac(s.arrays),
              itemFields: frac(s.itemFields),
              validation: frac(s.validation),
              byRule: Object.fromEntries(
                Object.entries(s.validation.byRule).map(([k, v]) => [k, `${v.hit}/${v.total}`])
              ),
              conditional: frac(s.conditional),
              behavior: frac(s.behavior),
              behaviorExpressible: frac(s.behaviorExpressible),
              visibility: frac(s.visibility),
              dataSources: frac(s.dataSources),
              unparsed: s.unparsed,
            }
          : {}),
      };
    }
  }
  if (t2) {
    m.t2 = t2.map((r) => ({
      run: `${r.case}/${r.source}/${r.target}`,
      status: r.status,
      crossCheckErrors: r.errors.length,
      intentProblems: r.intentProblems.length,
      warnings: r.warnings.length,
      files: r.files.length,
      tscErrors: r.tsc.length,
      layoutErrors: r.layout.errors,
      codeErrors: r.code.reduce((n, c) => n + (c.errors ?? 0), 0),
    }));
  }
  if (t4) {
    m.t4 = {
      chooseApi: Object.fromEntries(
        Object.entries(t4.chooseApi).map(([ch, list]) => [
          ch,
          {
            hit: `${list.filter((x) => x.hit).length}/${list.length}`,
            mentions: `${list.filter((x) => x.mentions).length}/${list.length}`,
          },
        ])
      ),
      askReformer: `${t4.ask.filter((x) => x.hit).length}/${t4.ask.length}`,
      symbolDocs: `${t4.symbolDocs.filter((x) => x.found).length}/${t4.symbolDocs.length}`,
      recipes: Object.fromEntries(
        Object.entries(t4.recipes).map(([ch, list]) => [
          ch,
          list.map((r) => `${r.topic}: ${r.title}`),
        ])
      ),
    };
  }
  if (t5) {
    const group = (set) => set.split('/')[0];
    m.t5 = { code: {}, layout: {}, jsonSchema: {} };
    for (const [ch, list] of Object.entries(t5.code)) {
      const byGroup = {};
      for (const r of list) {
        const g = (byGroup[group(r.set) === '__golden__' ? '__golden__' : r.set] ??= {
          files: 0,
          withErrors: 0,
        });
        g.files++;
        if (r.errors) g.withErrors++;
      }
      m.t5.code[ch] = byGroup;
    }
    for (const r of t5.layout)
      m.t5.layout[r.set] = { errors: r.errors, codes: [...new Set(r.codes)] };
    for (const r of t5.jsonSchema)
      m.t5.jsonSchema[r.set] = { errors: r.errors, codes: [...new Set(r.codes)] };
  }
  if (t6) {
    m.t6 = Object.fromEntries(
      Object.entries(t6).map(([tool, s]) =>
        tool === 'plan_form_warnings'
          ? [tool, { beyondBudget: `${s.beyondBudget}/${s.n}` }]
          : [
              tool,
              {
                n: s.n,
                keyInBudget: pct(s.keyInBudgetShare),
                fits: pct(s.fitsShare),
                medianChars: s.medianChars,
              },
            ]
      )
    );
  }
  return m;
}

function renderT3(t3, L) {
  L.push('## T3 — рантайм: e2e эталонов по формам из эталонных intent', '');
  L.push('| проект | пройдено |', '| --- | --- |');
  for (const [p, s] of Object.entries(t3.byProject)) L.push(`| ${p} | ${s.passed}/${s.total} |`);
  L.push('');
  for (const [p, s] of Object.entries(t3.byProject)) {
    if (!s.failed.length) continue;
    L.push(`**${p}** — падения:`, '');
    for (const f of s.failed.slice(0, 25)) L.push(`- ${f.replace(/\|/g, '\\|')}`);
    if (s.failed.length > 25) L.push(`- … ещё ${s.failed.length - 25}`);
    L.push('');
  }
}

export function renderReport({ smoke, t1, t2, t3, t4, t5, t6 }, meta) {
  const L = [];
  L.push(`# Калибровка @reformer/mcp — прогон ${meta.startedAt}`, '');
  L.push(`Каналы: ${meta.channels.join(', ')}. Inspector ${meta.inspector}.`, '');

  if (smoke) {
    L.push('## Этап 0 — протокольный smoke', '');
    L.push('| id | канал | проверка | итог | детали |', '| --- | --- | --- | --- | --- |');
    for (const c of smoke) {
      if (c.status === 'pass') continue;
      L.push(
        `| ${c.id} | ${c.channel} | ${c.title} | ${c.status} | ${String(c.detail).replace(/\|/g, '\\|').slice(0, 220)} |`
      );
    }
    L.push(
      '',
      `pass ${smoke.filter((c) => c.status === 'pass').length}, fail ${smoke.filter((c) => c.status === 'fail').length}, info ${smoke.filter((c) => c.status === 'info').length} (pass не показаны)`,
      ''
    );
  }

  if (t1) {
    L.push('## T1 — спека → intent (`plan_form`)', '');
    L.push(
      '| кейс | поля | шаги | по шагам | массивы | поля строк | правила | условные | поведение (выразимое) | видимость | источники | не разобрано | паритет |'
    );
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const [id, e] of Object.entries(t1)) {
      const s = (e.channels.node ?? e.channels.worker)?.score;
      const c = (e.channels.node ?? e.channels.worker)?.counts;
      if (s) {
        L.push(
          `| ${id} | ${frac(s.fields)} | ${s.steps.actual}/${s.steps.expected} | ${frac(s.steps.placement)} | ${frac(s.arrays)} | ${frac(s.itemFields)} | ${frac(s.validation)} | ${frac(s.conditional)} | ${frac(s.behavior)} (${frac(s.behaviorExpressible)}) | ${frac(s.visibility)} | ${frac(s.dataSources)} | ${s.unparsed} | ${e.parity ?? '—'} |`
        );
      } else {
        L.push(
          `| ${id} (${e.role}) | ${c?.fields} полей | — | — | ${c?.arrays} | — | ${c?.rules} | — | ${c?.behavior} | ${c?.visibility} | — | ${c?.warnings} предупр. | ${e.parity ?? '—'} |`
        );
      }
    }
    L.push('');
    for (const [id, e] of Object.entries(t1)) {
      const s = (e.channels.node ?? e.channels.worker)?.score;
      if (!s) continue;
      L.push(
        `**${id}** — правила по видам: ${Object.entries(s.validation.byRule)
          .map(([k, v]) => `${k} ${v.hit}/${v.total}`)
          .join(', ')}`
      );
      if (s.fields.missing.length)
        L.push(
          `- нет полей: ${s.fields.missing.slice(0, 15).join(', ')}${s.fields.missing.length > 15 ? '…' : ''}`
        );
      if (s.fields.extra.length) L.push(`- лишние поля: ${s.fields.extra.slice(0, 15).join(', ')}`);
      if (s.fields.typeMismatch.length)
        L.push(`- тип: ${s.fields.typeMismatch.slice(0, 10).join('; ')}`);
      if (s.fields.componentMismatch.length)
        L.push(`- компонент: ${s.fields.componentMismatch.slice(0, 10).join('; ')}`);
      if (s.validation.missing.length)
        L.push(
          `- не извлечены правила: ${s.validation.missing.slice(0, 20).join(', ')}${s.validation.missing.length > 20 ? '…' : ''}`
        );
      if (s.behavior.missing.length)
        L.push(`- нет связей: ${s.behavior.missing.slice(0, 15).join(', ')}`);
      L.push('');
    }
  }

  if (t2) {
    L.push('## T2 — intent → бандл (`generate_form` + tsc + `validate_form`)', '');
    L.push(
      '| кейс / intent / таргет | cross-check | C-ошибки | потери intent | предупр. | файлы | tsc | layout | code |'
    );
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of t2) {
      L.push(
        `| ${r.case} / ${r.source} / ${r.target} | ${r.status} | ${r.errors.length} | ${r.intentProblems.length} | ${r.warnings.length} | ${r.files.length} | ${r.tsc.length} | ${r.layout.errors ?? '?'} | ${r.code.reduce((n, c) => n + (c.errors ?? 0), 0)} |`
      );
    }
    L.push('');
    const tscSeen = new Map();
    for (const r of t2) {
      for (const d of r.tsc) {
        const key = `${d.file}: ${d.message.slice(0, 160)}`;
        tscSeen.set(key, [...(tscSeen.get(key) ?? []), `${r.case}/${r.source}/${r.target}`]);
      }
    }
    if (tscSeen.size) {
      L.push('Ошибки tsc (уникальные):', '');
      for (const [k, runs] of [...tscSeen.entries()].slice(0, 40))
        L.push(`- \`${k}\` — ${runs.length} прогон(ов)`);
      L.push('');
    }
    const probs = new Set(
      t2.flatMap((r) =>
        [...r.errors, ...r.intentProblems].map((x) => `${r.case}/${r.source}: ${x.slice(0, 200)}`)
      )
    );
    if (probs.size) {
      L.push('Ошибки кросс-проверки и потери intent:', '');
      for (const p of [...probs].slice(0, 40)) L.push(`- ${p}`);
      L.push('');
    }
  }

  if (t3) renderT3(t3, L);

  if (t4) {
    L.push('## T4 — подбор API', '');
    for (const [ch, list] of Object.entries(t4.chooseApi)) {
      L.push(
        `- \`choose_api\` (${ch}): оператор угадан ${list.filter((x) => x.hit).length}/${list.length}, ожидаемое упомянуто ${list.filter((x) => x.mentions).length}/${list.length}`
      );
    }
    L.push(
      `- \`askReformer\` (бюджет ask_reformer): ожидаемое в ответе ${t4.ask.filter((x) => x.hit).length}/${t4.ask.length}`
    );
    L.push(
      `- \`get_symbol_docs\` по символам эталонов: ${t4.symbolDocs.filter((x) => x.found).length}/${t4.symbolDocs.length}`,
      ''
    );
    const miss = t4.chooseApi.node?.filter((x) => !x.hit) ?? [];
    if (miss.length) {
      L.push('Промахи `choose_api` (node): ', '');
      for (const x of miss)
        L.push(
          `- ${x.id}: выбран \`${x.picked}\`${x.mentions ? ' (ожидаемое упомянуто ниже)' : ''}`
        );
      L.push('');
    }
    const askMiss = t4.ask.filter((x) => !x.hit);
    if (askMiss.length) {
      L.push('Промахи `askReformer`:', '');
      for (const x of askMiss) L.push(`- ${x.id}: ${x.trace}`);
      L.push('');
    }
    const notFound = t4.symbolDocs.filter((x) => !x.found).map((x) => x.symbol);
    if (notFound.length) L.push(`Нет документации символов: ${notFound.join(', ')}`, '');
    L.push('Рецепты по каналам:', '');
    for (const [ch, list] of Object.entries(t4.recipes)) {
      for (const r of list)
        L.push(`- ${ch} · ${r.topic}: ${r.title} — ${r.source} (${r.chars} симв.)`);
    }
    L.push('');
  }

  if (t5) {
    L.push('## T5 — проверка кода на рабочих эталонах (любая ошибка — ложная)', '');
    for (const [ch, list] of Object.entries(t5.code)) {
      const bad = list.filter((r) => r.errors);
      L.push(`- \`validate_form code\` (${ch}): файлов ${list.length}, с ошибками ${bad.length}`);
    }
    L.push('');
    const bad = (t5.code.node ?? Object.values(t5.code)[0] ?? []).filter((r) => r.errors);
    const byCode = {};
    for (const r of bad) for (const c of r.codes) (byCode[c] ??= []).push(`${r.set}:${r.file}`);
    for (const [code, files] of Object.entries(byCode)) {
      L.push(
        `- **${code}** — ${files.length} файл(ов): ${files.slice(0, 6).join(', ')}${files.length > 6 ? '…' : ''}`
      );
    }
    L.push('', 'Раскладка (`kind=layout`):', '');
    for (const r of t5.layout)
      L.push(
        `- ${r.set}: ошибок ${r.errors}${r.codes.length ? ` — ${[...new Set(r.codes)].join(', ')}` : ''}`
      );
    L.push('', 'JSON-схемы (`kind=json-schema`):', '');
    for (const r of t5.jsonSchema)
      L.push(
        `- ${r.set}: ошибок ${r.errors}${r.codes.length ? ` — ${[...new Set(r.codes)].join(', ')}` : ''}`
      );
    L.push('');
  }

  if (t6) {
    L.push('## T6 — пригодность ответа агенту (бюджет `mcp_call` 1400 символов)', '');
    L.push(
      '| инструмент | ответов | главное в бюджете | весь ответ в бюджете | медиана, симв. | макс. |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    for (const [tool, s] of Object.entries(t6)) {
      if (tool === 'plan_form_warnings') continue;
      L.push(
        `| ${tool} | ${s.n} | ${pct(s.keyInBudgetShare)} | ${pct(s.fitsShare)} | ${s.medianChars} | ${s.maxChars} |`
      );
    }
    const w = t6.plan_form_warnings;
    if (w)
      L.push(
        '',
        `Предупреждения \`plan_form\` начинаются за пределами бюджета в ${w.beyondBudget} из ${w.n} ответов (позиции: ${w.positions.join(', ')}).`
      );
    L.push('');
  }
  return L.join('\n');
}
