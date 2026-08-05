/**
 * Полный цикл шаблонов на in-memory FS: файлы проекта → шаблон с плейсхолдерами → новая форма с
 * подставленным именем. Живой пикер каталога автоматизацией не проходится, поэтому проверяем здесь.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@reformer/ui-kit/sonner', () => ({ toast: vi.fn() }));
vi.mock('./save-actions', () => ({
  rescanProject: vi.fn(() => Promise.resolve()),
  openCreatedFile: vi.fn(() => Promise.resolve()),
}));
// Стор шаблонов лезет в IndexedDB, которой нет в node-окружении: здесь проверяем работу с диском.
vi.mock('../store/templates-store', () => ({ reloadTemplates: vi.fn(() => Promise.resolve()) }));

import { fakeRoot } from '../io/__fixtures__/fake-fs';
import { createFileDeep, listFilesDeep, readTextFile } from '../io/fs-ops';
import { loadProjectTemplates, templatesDir } from '../io/template-repo';
import { projectActions } from '../store/project-store';
import { resetRuntimeState } from '../config/state';
import type { TreeEntry } from '../io/discovery';
import { createTemplateFrom, generateFromTemplate } from './template-actions';
import { openCreatedFile } from './save-actions';

const FORM_DIR = 'src/forms/credit-application';

/** Проект с готовой формой: две «наши» записи в дереве + файлы на фейковом диске. */
async function projectWithForm(): Promise<FileSystemDirectoryHandle> {
  const root = fakeRoot();
  await createFileDeep(
    root,
    FORM_DIR,
    'index.tsx',
    "import './credit-application.css';\nexport default function CreditApplicationForm() {}\n"
  );
  await createFileDeep(root, FORM_DIR, 'model.ts', 'export const creditApplicationInitial = {};\n');
  await createFileDeep(root, FORM_DIR, 'form.json', '{"root":{"component":"$html(div)"}}\n');

  const tree: TreeEntry[] = [
    { path: 'src/forms', name: 'forms', kind: 'directory', depth: 1 },
    { path: FORM_DIR, name: 'credit-application', kind: 'directory', depth: 2 },
    { path: `${FORM_DIR}/index.tsx`, name: 'index.tsx', kind: 'file', depth: 3 },
    { path: `${FORM_DIR}/model.ts`, name: 'model.ts', kind: 'file', depth: 3 },
    { path: `${FORM_DIR}/form.json`, name: 'form.json', kind: 'file', depth: 3 },
  ];
  projectActions.set({ dirHandle: root, dirName: 'project', tree });
  return root;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  projectActions.clear();
  resetRuntimeState();
});

describe('createTemplateFrom', () => {
  it('папка целиком → шаблон с плейсхолдерами вместо имени формы', async () => {
    const root = await projectWithForm();
    await createTemplateFrom([FORM_DIR], {
      name: 'Кредитная форма',
      baseName: 'credit-application',
      target: 'project',
    });

    const [tpl] = await loadProjectTemplates(root);
    expect(tpl.name).toBe('Кредитная форма');
    expect(tpl.files.map((f) => f.path).sort()).toEqual(['form.json', 'index.tsx', 'model.ts']);

    const index = tpl.files.find((f) => f.path === 'index.tsx')!;
    expect(index.content).toContain('function __FormName__Form()');
    expect(index.content).toContain("'./__form-name__.css'");
    expect(tpl.files.find((f) => f.path === 'model.ts')!.content).toContain('__formName__Initial');
  });

  it('выбор отдельных файлов сохраняет только их', async () => {
    const root = await projectWithForm();
    await createTemplateFrom([`${FORM_DIR}/model.ts`, `${FORM_DIR}/form.json`], {
      name: 'Только модель',
      baseName: 'credit-application',
      target: 'project',
    });
    const [tpl] = await loadProjectTemplates(root);
    expect(tpl.files.map((f) => f.path).sort()).toEqual(['form.json', 'model.ts']);
  });

  it('без имени шаблона ничего не пишет', async () => {
    const root = await projectWithForm();
    await createTemplateFrom([FORM_DIR], { name: '  ', baseName: '', target: 'project' });
    expect(await listFilesDeep(root, templatesDir())).toEqual([]);
  });
});

describe('generateFromTemplate', () => {
  it('создаёт папку формы с подставленным именем и открывает схему', async () => {
    const root = await projectWithForm();
    await createTemplateFrom([FORM_DIR], {
      name: 'Кредитная форма',
      baseName: 'credit-application',
      target: 'project',
    });
    const [tpl] = await loadProjectTemplates(root);

    await generateFromTemplate(
      'src/forms',
      'user-profile',
      tpl,
      tpl.files.map((f) => f.path)
    );

    const created = await listFilesDeep(root, 'src/forms/user-profile');
    expect(created.sort()).toEqual(['form.json', 'index.tsx', 'model.ts']);
    const index = await readTextFile(root, 'src/forms/user-profile/index.tsx');
    expect(index).toContain('export default function UserProfileForm()');
    expect(index).toContain("'./user-profile.css'");

    // Схема формы из набора открывается в canvas.
    expect(vi.mocked(openCreatedFile)).toHaveBeenCalledWith(
      'src/forms/user-profile/form.json',
      'form.json',
      expect.anything(),
      true
    );
  });

  it('занятое имя папки не перезаписывается, а получает свободное', async () => {
    const root = await projectWithForm();
    await createTemplateFrom([FORM_DIR], {
      name: 'Кредитная форма',
      baseName: 'credit-application',
      target: 'project',
    });
    const [tpl] = await loadProjectTemplates(root);

    await generateFromTemplate('src/forms', 'credit-application', tpl, ['model.ts']);

    // Исходная форма цела, копия легла рядом.
    expect(await listFilesDeep(root, FORM_DIR)).toContain('index.tsx');
    expect(await listFilesDeep(root, 'src/forms/credit-application-2')).toEqual(['model.ts']);
  });

  it('пустой выбор файлов ничего не создаёт', async () => {
    const root = await projectWithForm();
    await createTemplateFrom([FORM_DIR], {
      name: 'Кредитная форма',
      baseName: 'credit-application',
      target: 'project',
    });
    const [tpl] = await loadProjectTemplates(root);

    await generateFromTemplate('src/forms', 'user-profile', tpl, []);
    expect(await listFilesDeep(root, 'src/forms/user-profile')).toEqual([]);
  });
});
