/**
 * Исходники форм бенчмарка «ReFormer в React, Vue и Angular» для демо /benchmark/frameworks/demo —
 * строками через `?raw` (лоадер `plugins/raw-source-loader.cjs`): на странице всегда тот код, из
 * которого собраны показанные формы.
 *
 * Общее у трёх стеков — документ формы, сборка, правила (`projects/forms-benchmark/src/cross` и
 * `src/libs/reformer-kit`); своё у стека — реестр кита и вход страницы (`<хост>/src/cross`).
 */
import registrationDocument from '../../../../forms-benchmark/src/cross/registration.form.json?raw';
import registrationAssembly from '../../../../forms-benchmark/src/cross/registration.ts?raw';
import registrationRules from '../../../../forms-benchmark/src/libs/reformer-kit/registration-rules.ts?raw';
import creditDocument from '../../../../forms-benchmark/src/cross/credit.form.json?raw';
import creditAssembly from '../../../../forms-benchmark/src/cross/credit.ts?raw';
import creditRules from '../../../../forms-benchmark/src/libs/reformer-kit/credit/rules.ts?raw';
import creditBehavior from '../../../../forms-benchmark/src/libs/reformer-kit/credit/behavior.ts?raw';
import reactRegistry from '../../../../react-playground/src/cross/registry.ts?raw';
import reactRegistration from '../../../../react-playground/src/cross/registration/main.tsx?raw';
import reactCredit from '../../../../react-playground/src/cross/credit/main.tsx?raw';
import vueRegistry from '../../../../vue-playground/src/cross/registry.ts?raw';
import vueRegistration from '../../../../vue-playground/src/cross/registration/main.ts?raw';
import vueCredit from '../../../../vue-playground/src/cross/credit/main.ts?raw';
import angularRegistry from '../../../../angular-playground/src/cross/registry.ts?raw';
import angularRegistration from '../../../../angular-playground/src/cross/registration/page.ts?raw';
import angularCredit from '../../../../angular-playground/src/cross/credit/page.ts?raw';

export type DemoFormId = 'registration' | 'credit';
export type DemoStackId = 'react' | 'vue' | 'angular';

export interface SourceFile {
  /** Путь от корня репозитория — заголовок блока кода и ссылка на GitHub. */
  path: string;
  language: 'json' | 'ts' | 'tsx';
  code: string;
}

/** Вкладка общего кода формы. */
export interface SharedTab {
  id: 'document' | 'assembly' | 'rules' | 'behavior';
  file: SourceFile;
}

const file = (path: string, code: string): SourceFile => ({
  path,
  code,
  language: path.endsWith('.json') ? 'json' : path.endsWith('.tsx') ? 'tsx' : 'ts',
});

const BENCH = 'projects/forms-benchmark/src';

export const SHARED: Record<DemoFormId, SharedTab[]> = {
  registration: [
    {
      id: 'document',
      file: file(`${BENCH}/cross/registration.form.json`, registrationDocument),
    },
    { id: 'assembly', file: file(`${BENCH}/cross/registration.ts`, registrationAssembly) },
    {
      id: 'rules',
      file: file(`${BENCH}/libs/reformer-kit/registration-rules.ts`, registrationRules),
    },
  ],
  credit: [
    { id: 'document', file: file(`${BENCH}/cross/credit.form.json`, creditDocument) },
    { id: 'assembly', file: file(`${BENCH}/cross/credit.ts`, creditAssembly) },
    { id: 'rules', file: file(`${BENCH}/libs/reformer-kit/credit/rules.ts`, creditRules) },
    { id: 'behavior', file: file(`${BENCH}/libs/reformer-kit/credit/behavior.ts`, creditBehavior) },
  ],
};

/** Обвязка стека: реестр кита (общий для форм) и вход страницы формы. */
export const STACK: Record<DemoStackId, { registry: SourceFile } & Record<DemoFormId, SourceFile>> =
  {
    react: {
      registry: file('projects/react-playground/src/cross/registry.ts', reactRegistry),
      registration: file(
        'projects/react-playground/src/cross/registration/main.tsx',
        reactRegistration
      ),
      credit: file('projects/react-playground/src/cross/credit/main.tsx', reactCredit),
    },
    vue: {
      registry: file('projects/vue-playground/src/cross/registry.ts', vueRegistry),
      registration: file('projects/vue-playground/src/cross/registration/main.ts', vueRegistration),
      credit: file('projects/vue-playground/src/cross/credit/main.ts', vueCredit),
    },
    angular: {
      registry: file('projects/angular-playground/src/cross/registry.ts', angularRegistry),
      registration: file(
        'projects/angular-playground/src/cross/registration/page.ts',
        angularRegistration
      ),
      credit: file('projects/angular-playground/src/cross/credit/page.ts', angularCredit),
    },
  };
