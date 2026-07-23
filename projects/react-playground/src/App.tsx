import { memo, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { MenuIcon, XIcon } from 'lucide-react';
import CreditApplicationForm from './pages/examples/complex-multy-step-form/CreditApplicationForm';
import CreditApplicationFormRenderer from './pages/examples/complex-multy-step-form-renderer/CreditApplicationFormRenderer';
import RegistrationFormRendererJson from './pages/examples/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson';
import RegistrationForm from './pages/examples/registration-form/RegistrationForm';
import ValidationExamples from './pages/examples/validation/ValidationExamples';
import BehaviorsExamples from './pages/examples/behaviors/BehaviorsExamples';
import MccaCoreV20 from './pages/examples/mcp-credit-application-core-v20';
import MccaRendererReactV20 from './pages/examples/mcp-credit-application-renderer-react-v20';
import MccaRendererJsonV20 from './pages/examples/mcp-credit-application-renderer-json-v20';
import ImperativeHandles from './pages/examples/imperative-handles/ImperativeHandles';
import HtmlNodesExample from './pages/examples/html-nodes/HtmlNodesExample';
import RegistrationFormJson from './pages/examples/registration-form-renderer-json/RegistrationFormRendererJson';
import FileUploadDemo from './pages/examples/file-upload/FileUploadDemo';
type ExamplePage =
  | 'simple'
  | 'validation'
  | 'behaviors'
  | 'async-select'
  | 'complex'
  | 'complex-renderer'
  | 'json-renderer'
  | 'mcca-core-v20'
  | 'mcca-renderer-react-v20'
  | 'mcca-renderer-json-v20'
  | 'imperative-handles'
  | 'html-nodes'
  | 'registration-json'
  | 'file-upload';

interface ExampleEntry {
  id: ExamplePage;
  path: string;
  title: string;
  description: string;
}

/** Группы боковой навигации (порядок групп и пунктов = порядок в сайдбаре). */
const exampleGroups: { title: string; items: ExampleEntry[] }[] = [
  {
    title: 'Основы',
    items: [
      {
        id: 'validation',
        path: '/examples/validation',
        title: 'Валидация',
        description: 'Встроенные валидаторы',
      },
      {
        id: 'behaviors',
        path: '/examples/behaviors',
        title: 'Поведения',
        description: 'Реактивное поведение через декларативный подход',
      },
      {
        id: 'simple',
        path: '/examples/simple',
        title: 'Форма регистрации',
        description: 'Регистрация с асинхронной валидацией, behaviors и маской телефона',
      },
    ],
  },
  {
    title: 'Комплексная форма',
    items: [
      {
        id: 'complex',
        path: '/examples/complex',
        title: 'Compound-компоненты',
        description: 'Многошаговая форма кредитной заявки',
      },
      {
        id: 'complex-renderer',
        path: '/examples/complex-renderer',
        title: 'Renderer',
        description: 'Та же форма через renderSchema API',
      },
      {
        id: 'json-renderer',
        path: '/examples/json-renderer',
        title: 'JSON Renderer',
        description: 'Рендеринг формы из JSON-схемы через @reformer/renderer-json',
      },
    ],
  },
  {
    title: 'MCP-генерация',
    items: [
      {
        id: 'mcca-core-v20',
        path: '/examples/mcca-core-v20',
        title: 'core v20',
        description:
          'Сгенерировано MCP (v20, minimalist form-* layout) — core: createForm + FormWizard',
      },
      {
        id: 'mcca-renderer-react-v20',
        path: '/examples/mcca-renderer-react-v20',
        title: 'renderer-react v20',
        description:
          'Сгенерировано MCP (v20, minimalist form-* layout) — renderer-react: createRenderSchema',
      },
      {
        id: 'mcca-renderer-json-v20',
        path: '/examples/mcca-renderer-json-v20',
        title: 'renderer-json v20',
        description:
          'Сгенерировано MCP (v20, minimalist form-* layout) — renderer-json: JSON + registry',
      },
    ],
  },
  {
    title: 'Компоненты и API',
    items: [
      {
        id: 'file-upload',
        path: '/examples/file-upload',
        title: 'FileUpload',
        description:
          'Поле загрузки файлов: button/dropzone/input/avatar, deferred (File[]) и immediate (RemoteFileRef[] через uploader)',
      },
      {
        id: 'imperative-handles',
        path: '/examples/imperative-handles',
        title: 'Императивные handle',
        description:
          'schema.node(sel).getRef<H>() — focus/open/clear/toggle живых компонентов по селектору',
      },
      {
        id: 'html-nodes',
        path: '/examples/html-nodes',
        title: 'HTML-узлы',
        description:
          'Нативные теги и текст прямо в схеме: component: \'div\' / "$html(div)" и реактивный text из модели',
      },
      {
        id: 'registration-json',
        path: '/examples/registration-json',
        title: 'Регистрация (JSON)',
        description:
          'Весь экран из JSON: AsyncBoundary грузит префилл, в .tsx только Provider и Renderer',
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
        {exampleGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <h2 className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              {group.title}
            </h2>
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
            <Route path="/examples/simple" element={<RegistrationForm />} />
            <Route path="/examples/validation" element={<ValidationExamples />} />
            <Route path="/examples/behaviors" element={<BehaviorsExamples />} />
            <Route path="/examples/complex" element={<CreditApplicationForm />} />
            <Route path="/examples/complex-renderer" element={<CreditApplicationFormRenderer />} />
            <Route path="/examples/json-renderer" element={<RegistrationFormRendererJson />} />
            <Route path="/examples/mcca-core-v20" element={<MccaCoreV20 />} />
            <Route path="/examples/mcca-renderer-react-v20" element={<MccaRendererReactV20 />} />
            <Route path="/examples/mcca-renderer-json-v20" element={<MccaRendererJsonV20 />} />
            <Route path="/examples/imperative-handles" element={<ImperativeHandles />} />
            <Route path="/examples/html-nodes" element={<HtmlNodesExample />} />
            <Route path="/examples/registration-json" element={<RegistrationFormJson />} />
            <Route path="/examples/file-upload" element={<FileUploadDemo />} />
            <Route path="/" element={<Navigate to="/examples/simple" replace />} />
            <Route path="*" element={<Navigate to="/examples/simple" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
