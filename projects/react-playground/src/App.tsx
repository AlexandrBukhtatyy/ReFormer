import { memo, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { MenuIcon, XIcon } from 'lucide-react';
import CreditApplicationForm from './pages/demo/complex-multy-step-form/CreditApplicationForm';
import CreditApplicationFormRenderer from './pages/demo/complex-multy-step-form-renderer/CreditApplicationFormRenderer';
import RegistrationFormRendererJson from './pages/demo/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson';
import CreditApplicationFormRegistry from './pages/demo/complex-multy-step-form-registry';
import RegistrationForm from './pages/demo/registration-form/RegistrationForm';
import ValidationExamples from './pages/demo/validation/ValidationExamples';
import BehaviorsExamples from './pages/demo/behaviors/BehaviorsExamples';
import MccaCoreV20 from './pages/debug/mcp-credit-application-core-v20';
import MccaRendererReactV20 from './pages/debug/mcp-credit-application-renderer-react-v20';
import MccaRendererJsonV20 from './pages/debug/mcp-credit-application-renderer-json-v20';
import NewMcpTestV2 from './pages/debug/new-mcp-test-v2';
import ImperativeHandles from './pages/demo/imperative-handles/ImperativeHandles';
import HtmlNodesExample from './pages/demo/html-nodes/HtmlNodesExample';
import RegistrationFormJson from './pages/demo/registration-form-renderer-json/RegistrationFormRendererJson';
import AlertsListRendererJson from './pages/demo/alerts-list-renderer-json/AlertsListRendererJson';
import FileUploadDemo from './pages/demo/file-upload/FileUploadDemo';
import MultiSelectDemo from './pages/demo/multi-select/MultiSelectDemo';
import TreeDemo from './pages/demo/tree/TreeDemo';
import FormRegistryLab from './pages/debug/form-registry-lab/FormRegistryLab';
import UiBuilderDemo from './pages/debug/ui_builder';
import { getFormRegistry, type ResolveContext } from '@reformer/form-registry';
import { FormRegistryProvider } from '@reformer/form-registry/react';
import { baseComponentRegistry, registerPlaygroundForms } from './forms/registry';
type ExamplePage =
  | 'simple'
  | 'validation'
  | 'behaviors'
  | 'async-select'
  | 'complex'
  | 'complex-renderer'
  | 'json-renderer'
  | 'form-registry'
  | 'mcca-core-v20'
  | 'mcca-renderer-react-v20'
  | 'mcca-renderer-json-v20'
  | 'new-mcp-test-v2'
  | 'imperative-handles'
  | 'html-nodes'
  | 'registration-json'
  | 'alerts-json'
  | 'file-upload'
  | 'multi-select'
  | 'tree'
  | 'form-registry-lab'
  | 'ui-builder';

interface ExampleEntry {
  id: ExamplePage;
  path: string;
  title: string;
  description: string;
}

/**
 * Раздел витрины. `demo` — страницы, показывающие возможности библиотеки (живут в
 * `pages/demo/`, роуты `/demo/*`); `debug` — стенды и артефакты разработки: MCP-генерации,
 * компиляция формы в браузере, метрики реестра (`pages/debug/`, роуты `/debug/*`).
 */
type PageSection = 'demo' | 'debug';

interface ExampleGroup {
  section: PageSection;
  title: string;
  items: ExampleEntry[];
}

/** Заголовки разделов в сайдбаре — в порядке отображения. */
const SECTIONS: { id: PageSection; title: string }[] = [
  { id: 'demo', title: 'Демо' },
  { id: 'debug', title: 'Отладка' },
];

/** Группы боковой навигации (порядок групп и пунктов = порядок в сайдбаре). */
const exampleGroups: ExampleGroup[] = [
  {
    section: 'demo',
    title: 'Основы',
    items: [
      {
        id: 'validation',
        path: '/demo/validation',
        title: 'Валидация',
        description: 'Встроенные валидаторы',
      },
      {
        id: 'behaviors',
        path: '/demo/behaviors',
        title: 'Поведения',
        description: 'Реактивное поведение через декларативный подход',
      },
      {
        id: 'simple',
        path: '/demo/simple',
        title: 'Форма регистрации',
        description: 'Регистрация с асинхронной валидацией, behaviors и маской телефона',
      },
    ],
  },
  {
    section: 'demo',
    title: 'Комплексная форма',
    items: [
      {
        id: 'complex',
        path: '/demo/complex',
        title: 'Compound-компоненты',
        description: 'Многошаговая форма кредитной заявки',
      },
      {
        id: 'complex-renderer',
        path: '/demo/complex-renderer',
        title: 'Renderer',
        description: 'Та же форма через renderSchema API',
      },
      {
        id: 'json-renderer',
        path: '/demo/json-renderer',
        title: 'JSON Renderer',
        description: 'Рендеринг формы из JSON-схемы через @reformer/renderer-json',
      },
      {
        id: 'form-registry',
        path: '/demo/form-registry',
        title: 'Реестр форм',
        description: 'Та же JSON-форма, но смонтирована по id через @reformer/form-registry',
      },
    ],
  },
  {
    section: 'debug',
    title: 'MCP-генерация',
    items: [
      {
        id: 'mcca-core-v20',
        path: '/debug/mcca-core-v20',
        title: 'core v20',
        description:
          'Сгенерировано MCP (v20, minimalist form-* layout) — core: createForm + FormWizard',
      },
      {
        id: 'mcca-renderer-react-v20',
        path: '/debug/mcca-renderer-react-v20',
        title: 'renderer-react v20',
        description:
          'Сгенерировано MCP (v20, minimalist form-* layout) — renderer-react: createRenderSchema',
      },
      {
        id: 'mcca-renderer-json-v20',
        path: '/debug/mcca-renderer-json-v20',
        title: 'renderer-json v20',
        description:
          'Сгенерировано MCP (v20, minimalist form-* layout) — renderer-json: JSON + registry',
      },
      {
        id: 'new-mcp-test-v2',
        path: '/debug/new-mcp-test-v2',
        title: 'new-mcp-test-v2 (renderer-json)',
        description: 'MCP-only прогон: заявка на кредит по спеке, 6 шагов, renderer-json',
      },
    ],
  },
  {
    section: 'demo',
    title: 'Компоненты и API',
    items: [
      {
        id: 'file-upload',
        path: '/demo/file-upload',
        title: 'FileUpload',
        description:
          'Поле загрузки файлов: button/dropzone/input/avatar, deferred (File[]) и immediate (RemoteFileRef[] через uploader)',
      },
      {
        id: 'multi-select',
        path: '/demo/multi-select',
        title: 'Множественный выбор',
        description:
          'SelectMulti / ComboboxMulti / NativeSelectMulti / ToggleGroupMulti: единый контракт string[] | null, префилл, валидация',
      },
      {
        id: 'tree',
        path: '/demo/tree',
        title: 'Дерево и выбор файла',
        description:
          'Tree как отрисовка иерархии (раскрытие, выделение, набор, ленивые уровни) и поля ComboboxTree / ComboboxTreeMulti поверх него',
      },
      {
        id: 'imperative-handles',
        path: '/demo/imperative-handles',
        title: 'Императивные handle',
        description:
          'schema.node(sel).getRef<H>() — focus/open/clear/toggle живых компонентов по селектору',
      },
      {
        id: 'html-nodes',
        path: '/demo/html-nodes',
        title: 'HTML-узлы',
        description:
          'Нативные теги и текст прямо в схеме: component: \'div\' / "$html(div)" и реактивный текст из модели прямо в children',
      },
      {
        id: 'registration-json',
        path: '/demo/registration-json',
        title: 'Регистрация (JSON)',
        description:
          'Весь экран из JSON: AsyncBoundary грузит префилл, в .tsx только Provider и Renderer',
      },
      {
        id: 'alerts-json',
        path: '/demo/alerts-json',
        title: 'Список алертов (JSON)',
        description:
          'Итерация массива модели через $component(List) + $template; behavior меняет набор алертов',
      },
    ],
  },
  {
    section: 'debug',
    title: 'UI Builder',
    items: [
      {
        id: 'ui-builder',
        path: '/debug/ui-builder',
        title: 'Компиляция формы в браузере',
        description:
          'Правишь сайдкары и фикстуру — форма пересобирается; инспектор модели читает и правит значения',
      },
    ],
  },
  {
    section: 'debug',
    title: 'Реестр форм',
    items: [
      {
        id: 'form-registry-lab',
        path: '/debug/registry-lab',
        title: 'Стенд: кэш и метрики',
        description:
          'Три формы по HTTP через реестр: попадания в L1/L2, ревалидация 304, дедупликация, ретраи',
      },
    ],
  },
];

const examples: ExampleEntry[] = exampleGroups.flatMap((group) => group.items);

// Мемоизированная боковая навигация — не перерисовывается при изменениях в дочерних
// компонентах (роут-зависимая подсветка живёт внутри NavLink).
const Sidebar = memo(function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  console.debug('Sidebar render');
  return (
    <nav data-testid="sidebar-nav" className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <NavLink to="/" className="block" onClick={onNavigate}>
          <h1 className="text-xl font-bold text-blue-600">ReFormer</h1>
          <p className="text-xs text-gray-500">Интерактивные примеры</p>
        </NavLink>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          // Раздел («Демо» / «Отладка») — рамка сверху отделяет его от предыдущего;
          // у первого её нет, поэтому граница живёт на разделителе, а не на заголовке.
          <section key={section.id} className="mb-5 border-t pt-4 first:border-t-0 first:pt-0">
            <h2 className="mb-3 px-2 text-sm font-semibold text-gray-900">{section.title}</h2>
            {exampleGroups
              .filter((group) => group.section === section.id)
              .map((group) => (
                <div key={group.title} className="mb-5">
                  <h3 className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    {group.title}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((example) => (
                      <li key={example.id}>
                        <NavLink
                          to={example.path}
                          onClick={onNavigate}
                          title={example.description}
                          // Активный пункт — сдержанно: светлый фон + синий текст + полоска-акцент
                          // слева (border у всех, у неактивных прозрачный — без сдвига layout).
                          className={({ isActive }) =>
                            `block rounded-md border-l-2 px-2 py-1.5 text-sm transition-colors ${
                              isActive
                                ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                                : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                            }`
                          }
                        >
                          {example.title}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>
        ))}
      </div>

      <div className="border-t px-4 py-3 text-xs text-gray-500">
        <a
          href="https://github.com/AlexandrBukhtatyy/ReFormer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
});

// Шапка контента: название и описание текущего примера — зависит от location
function ExampleHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const location = useLocation();
  const currentExample = examples.find((e) => location.pathname.startsWith(e.path));

  return (
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur-sm">
      <div className="container mx-auto flex items-center gap-3 px-4 py-3 lg:px-6">
        <button
          type="button"
          aria-label="Открыть навигацию"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <MenuIcon className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-gray-900">
            {currentExample?.title ?? 'ReFormer Examples'}
          </h1>
          <p className="truncate text-xs text-gray-500">
            {currentExample?.description || 'Выберите пример в боковой панели'}
          </p>
        </div>
      </div>
    </header>
  );
}

function Layout() {
  // Мобильный оверлей сайдбара; на lg+ сайдбар всегда виден и state не участвует.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar: постоянный на lg+, оверлей на узких экранах */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-white lg:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              type="button"
              aria-label="Закрыть навигацию"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100"
            >
              <XIcon className="size-4" />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ExampleHeader onToggleSidebar={() => setSidebarOpen(true)} />

        {/* Контент — в центрированном контейнере, не на всю ширину */}
        <main className="container mx-auto w-full flex-1 px-4 py-6 lg:px-6">
          <Routes>
            <Route path="/demo/simple" element={<RegistrationForm />} />
            <Route path="/demo/validation" element={<ValidationExamples />} />
            <Route path="/demo/behaviors" element={<BehaviorsExamples />} />
            <Route path="/demo/complex" element={<CreditApplicationForm />} />
            <Route path="/demo/complex-renderer" element={<CreditApplicationFormRenderer />} />
            <Route path="/demo/json-renderer" element={<RegistrationFormRendererJson />} />
            <Route path="/demo/form-registry" element={<CreditApplicationFormRegistry />} />
            <Route path="/debug/mcca-core-v20" element={<MccaCoreV20 />} />
            <Route path="/debug/mcca-renderer-react-v20" element={<MccaRendererReactV20 />} />
            <Route path="/debug/mcca-renderer-json-v20" element={<MccaRendererJsonV20 />} />
            <Route path="/debug/new-mcp-test-v2" element={<NewMcpTestV2 />} />
            <Route path="/demo/imperative-handles" element={<ImperativeHandles />} />
            <Route path="/demo/html-nodes" element={<HtmlNodesExample />} />
            <Route path="/demo/registration-json" element={<RegistrationFormJson />} />
            <Route path="/demo/alerts-json" element={<AlertsListRendererJson />} />
            <Route path="/demo/file-upload" element={<FileUploadDemo />} />
            <Route path="/demo/multi-select" element={<MultiSelectDemo />} />
            <Route path="/demo/tree" element={<TreeDemo />} />
            <Route path="/debug/ui-builder" element={<UiBuilderDemo />} />
            <Route path="/debug/registry-lab" element={<FormRegistryLab />} />
            <Route path="/" element={<Navigate to="/demo/simple" replace />} />
            <Route path="*" element={<Navigate to="/demo/simple" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/**
 * Контекст разрешения форм. В витрине прав и флагов нет — все формы доступны;
 * в реальном приложении сюда приходят права пользователя и включённые фиче-флаги.
 */
const FORM_CONTEXT: ResolveContext = { permissions: new Set(), flags: new Set() };

function App() {
  // Регистрация до первого рендера: FormOutlet резолвит запись синхронно.
  registerPlaygroundForms();

  return (
    <BrowserRouter>
      <FormRegistryProvider
        registry={getFormRegistry()}
        context={FORM_CONTEXT}
        baseRegistry={baseComponentRegistry}
      >
        <Layout />
      </FormRegistryProvider>
    </BrowserRouter>
  );
}

export default App;
