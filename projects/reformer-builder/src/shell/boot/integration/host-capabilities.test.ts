/**
 * Возможности оболочки: объявлены и действительно зарегистрированы — на НАСТОЯЩЕМ запуске.
 *
 * Это приёмка фазы 4 плана `docs/plans/builder-v4-plugin-platform-plan.md` в той её части,
 * которая касается провайдера-оболочки. Разделяемое состояние рабочей области (документы,
 * фокус текстового редактора, снимки вида) даёт не плагин, поэтому у него нет ни манифеста,
 * ни `activate`, — и проверка `provides-unregistered`, стерегущая плагины, к нему не относится.
 * Вместо неё — этот тест.
 *
 * Проверяются ДВА конца одного обещания, и по отдельности они ничего не стоят:
 *
 * - **объявление** (`platform/services/host-capabilities` → `composer/compose` → состав)
 *   решает, поднимется ли внешний плагин с `requires`. Объяви оболочка то, чего нет, —
 *   и отказ уехал бы с проверки состава в рантайм чужого кода;
 * - **регистрация** (`boot`) решает, найдёт ли плагин службу. Зарегистрируй оболочка то,
 *   чего не объявляла, — и плагин, которому это нужно, не поднялся бы вовсе, хотя служба есть.
 *
 * Спрашивает их ПЛАГИН — через `ctx.services` и `ctx.capabilities`, то есть тем же путём,
 * что и внешний плагин из каталога проекта. Другого пути у него нет, и проверять надо ровно
 * этот: реестр служб `boot` наружу не отдаёт.
 *
 * Короткий профиль — не для полноты, а по существу: возможности оболочки не зависят от состава
 * плагинов, и `minimal` (без превью и редактора схемы) — единственный способ это утверждать.
 *
 * @module shell/boot/integration/host-capabilities.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { builderApplication } from '@/application/builder-application';
import { fromProfile } from '@/application/composer/compose';
import { builderProfile } from '@/application/profiles/builder';
import { minimalProfile } from '@/application/profiles/presets';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import { definePlugin } from '@reformer/builder-plugin-api/internal';
import { PluginsCatalogCapability } from '@reformer/builder-plugin-api/internal';
import { WorkspaceResourcesCapability } from '@reformer/builder-plugin-api/internal';
import { WorkspaceSaveCapability } from '@reformer/builder-plugin-api/internal';
import type { PluginPermission } from '@reformer/builder-plugin-api/internal';
import { HOST_CAPABILITIES, HOST_PROVIDER_ID } from '@/shell/platform/services/host-capabilities';
import { DocumentsServiceToken } from '@reformer/builder-plugin-api/internal';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

/** Окружение браузера в объёме, который трогает `boot` при сборке (как в `./minimal-profile`). */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners });
  vi.stubGlobal('document', {
    ...listeners,
    title: 'reformer-builder',
    documentElement: { classList: { add: () => {}, remove: () => {} } },
  });
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
});

/**
 * Поднимает приложение и спрашивает возможности ИЗНУТРИ плагина.
 *
 * Плагин регистрируется уже после `ready` — как плагин из каталога проекта, включённый
 * человеком: возможности оболочки обязаны быть на месте и в этот момент тоже.
 */
async function askFromPlugin(
  profile: Parameters<typeof fromProfile>[0],
  permissions: readonly PluginPermission[] = []
): Promise<{
  readonly found: readonly string[];
  readonly missing: readonly string[];
  readonly documentsWorks: boolean;
}> {
  stubBrowser();
  app = boot({ application: fromProfile(profile) });
  await app.ready;

  const found: string[] = [];
  const missing: string[] = [];
  let documentsWorks = false;

  app.plugins.register(
    definePlugin({
      id: 'probe',
      activate(ctx) {
        for (const capability of HOST_CAPABILITIES) {
          if (ctx.services.get(capability) === undefined) missing.push(capability.id);
          else found.push(capability.id);
        }
        // `require` — не то же, что `get`: он бросает, и именно им пользуется плагин,
        // которому без возможности нечего делать. Заодно проверяется, что служба отвечает,
        // а не просто занимает слот: проекта нет, и это её штатный ответ, а не отказ.
        documentsWorks = ctx.capabilities.require(DocumentsServiceToken).hasProject() === false;
      },
    }),
    [],
    permissions
  );
  expect(app.plugins.activate('probe')).toBe(true);

  return { found, missing, documentsWorks };
}

describe('возможности оболочки', () => {
  it('состав объявляет их все и приписывает оболочке, а не плагину', () => {
    // Именно этот список уходит в каталог проектных плагинов как «что даёт остальное
    // приложение» (`boot`: `capabilities: () => options.application.capabilities`).
    for (const capability of HOST_CAPABILITIES) {
      expect(builderApplication.capabilities).toContainEqual({
        id: capability.id,
        version: capability.version,
        by: HOST_PROVIDER_ID,
      });
    }
    expect(HOST_CAPABILITIES.length).toBeGreaterThanOrEqual(3);
  });

  it('на полном составе плагин находит каждую объявленную, кроме запертой правом', async () => {
    const asked = await askFromPlugin(builderProfile);

    // Все три привилегированные объявлены оболочкой, как и остальные, но ПЛАГИНУ не видны:
    // прав ему не подтверждали. Резолвер при этом отвечает «возможность в приложении есть» —
    // это разные вопросы, и отвечают на них в разных местах.
    const locked: readonly string[] = [
      WorkspaceSaveCapability.id,
      WorkspaceResourcesCapability.id,
      PluginsCatalogCapability.id,
    ];
    expect(asked.missing).toEqual(locked);
    expect(asked.found).toEqual(
      HOST_CAPABILITIES.map((capability) => capability.id).filter((id) => !locked.includes(id))
    );
    expect(asked.documentsWorks).toBe(true);
  });

  it('с подтверждёнными правами находит и запертые', async () => {
    const asked = await askFromPlugin(builderProfile, [
      'workspace.save',
      'workspace.resources',
      'plugins.manage',
    ]);

    expect(asked.missing).toEqual([]);
    expect(asked.found).toContain(WorkspaceSaveCapability.id);
    expect(asked.found).toContain(WorkspaceResourcesCapability.id);
    expect(asked.found).toContain(PluginsCatalogCapability.id);
  });

  it('право открывает ровно свою дверь, а не обе сразу', async () => {
    // Иначе «право» значило бы «привилегированный плагин», и второе право было бы
    // украшением первого.
    const asked = await askFromPlugin(builderProfile, ['workspace.resources']);

    expect(asked.missing).toEqual([WorkspaceSaveCapability.id, PluginsCatalogCapability.id]);
    expect(asked.found).toContain(WorkspaceResourcesCapability.id);
  });

  it('на коротком составе — те же: они не зависят от набора плагинов', async () => {
    const asked = await askFromPlugin(minimalProfile, [
      'workspace.save',
      'workspace.resources',
      'plugins.manage',
    ]);

    expect(asked.missing).toEqual([]);
    expect(asked.documentsWorks).toBe(true);
  });
});
