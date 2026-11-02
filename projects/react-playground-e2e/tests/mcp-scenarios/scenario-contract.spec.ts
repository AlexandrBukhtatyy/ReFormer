import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { checkA11y } from '../shared/a11y';

/**
 * Браузерная стадия верификатора MCP (`packages/reformer-mcp/eval/verify/browser.mjs`). Набор форм и
 * ожидания приходят манифестом: сами формы созданы агентом и в репозитории не лежат. Вне прогона
 * верификатора манифеста нет, и проект `mcp-scenarios` не запускается.
 */

interface ManifestField {
  id: string;
  aria?: { role?: string; name?: string };
  bind?: { label?: string };
}

interface ManifestProbe {
  id: string;
  set?: Record<string, unknown>;
  expect: { hidden?: string[]; visible?: string[]; readonly?: string[] };
}

interface ManifestEntry {
  slot: string;
  path: string;
  ariaFields: Array<{ id: string; role: string; name: string }>;
  probes: ManifestProbe[];
  fields: ManifestField[];
  screenshot: string;
  ariaArtifact: string;
}

const manifestFile = process.env.MCP_SCENARIO_MANIFEST;
const manifest: ManifestEntry[] = manifestFile
  ? JSON.parse(readFileSync(manifestFile, 'utf8'))
  : [];

const SEVERE_IMPACTS = ['serious', 'critical'];

function regexFrom(text: string): RegExp {
  const match = /^\/(.*)\/([a-z]*)$/.exec(text);
  return match ? new RegExp(match[1], match[2]) : new RegExp(text, 'i');
}

function fieldLocator(page: Page, entry: ManifestEntry, fieldId: string) {
  const field = entry.fields.find((item) => item.id === fieldId);
  const name = field?.aria?.name ?? field?.bind?.label ?? fieldId;
  return page.getByTestId('scenario-root').getByLabel(regexFrom(name));
}

/** Строка снимка доступности → роль и имя узла: `- textbox "Имя"`, `- 'heading "A" [level=3]'`. */
function parseAriaLine(line: string): { role: string; name: string } | null {
  const match = /^\s*-\s+'?([a-z]+)(?:\s+"((?:[^"\\]|\\.)*)")?/.exec(line);
  return match ? { role: match[1], name: match[2] ?? '' } : null;
}

/** Расхождения снимка с ожидаемыми полями: нет поля или порядок не тот. */
function ariaProblems(snapshot: string, fields: ManifestEntry['ariaFields']): string[] {
  const nodes = snapshot.split('\n').map(parseAriaLine);
  const problems: string[] = [];
  let previous = -1;
  for (const field of fields) {
    const roles = field.role.split('|');
    const name = regexFrom(field.name);
    const position = nodes.findIndex(
      (node) => node !== null && roles.includes(node.role) && name.test(node.name)
    );
    if (position < 0) problems.push(`нет ${field.role} ${field.name}`);
    else if (position < previous) problems.push(`${field.id} идёт раньше предыдущего поля`);
    else previous = position;
  }
  return problems;
}

async function openForm(page: Page, entry: ManifestEntry) {
  await page.goto(entry.path);
  await expect(
    page.getByTestId('scenario-root').or(page.getByTestId('scenario-error'))
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('scenario-error')).toHaveCount(0);
}

for (const entry of manifest) {
  test.describe(entry.slot, () => {
    test(`${entry.slot} :: browser.render`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openForm(page, entry);
      const root = page.getByTestId('scenario-root');
      // Снимок и скриншот — артефакты отчёта: их снимаем до проверок, чтобы был виден и провал.
      mkdirSync(path.dirname(entry.screenshot), { recursive: true });
      await page.screenshot({ path: entry.screenshot, fullPage: true });
      mkdirSync(path.dirname(entry.ariaArtifact), { recursive: true });
      writeFileSync(entry.ariaArtifact, await root.ariaSnapshot());

      await expect(
        root.locator('input, textarea, select, button, [role="combobox"]').first()
      ).toBeVisible();
      expect(pageErrors).toEqual([]);
    });

    test(`${entry.slot} :: browser.aria`, async ({ page }) => {
      test.skip(entry.ariaFields.length === 0, 'контракт не задаёт снимок доступности');
      await openForm(page, entry);
      const snapshot = await page.getByTestId('scenario-root').ariaSnapshot();
      expect(ariaProblems(snapshot, entry.ariaFields)).toEqual([]);
    });

    test(`${entry.slot} :: browser.axe`, async ({ page }) => {
      await openForm(page, entry);
      const result = await checkA11y(page, {
        tags: ['wcag2a', 'wcag2aa'],
        includeSelectors: ['[data-testid="scenario-root"]'],
      });
      // Хелпер молча отдаёт пустой результат, если axe не установлен: без проверок нет и вердикта.
      expect(result.passes, 'axe не выполнил ни одной проверки').toBeGreaterThan(0);
      const severe = result.violations
        .filter((violation) => SEVERE_IMPACTS.includes(violation.impact))
        .map((violation) => `${violation.id} (${violation.nodes.length})`);
      expect(severe).toEqual([]);
    });

    for (const probe of entry.probes) {
      test(`${entry.slot} :: browser.probe.${probe.id}`, async ({ page }) => {
        await openForm(page, entry);
        for (const id of probe.expect.hidden ?? []) {
          await expect(fieldLocator(page, entry, id), `${id} виден`).toHaveCount(0);
        }
        for (const id of probe.expect.visible ?? []) {
          await expect(fieldLocator(page, entry, id), `${id} не виден`).toBeVisible();
        }
        for (const id of probe.expect.readonly ?? []) {
          // Сначала поле должно найтись: на пустом локаторе проверка упала бы с тем же текстом.
          await expect(fieldLocator(page, entry, id), `нет поля ${id}`).toHaveCount(1);
          await expect(
            fieldLocator(page, entry, id),
            `${id} доступен для ввода`
          ).not.toBeEditable();
        }
      });
    }
  });
}
