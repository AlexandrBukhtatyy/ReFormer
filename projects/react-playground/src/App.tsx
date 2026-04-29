import { memo } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import CreditApplicationForm from './pages/examples/complex-multy-step-form/CreditApplicationForm';
import CreditApplicationFormRenderer from './pages/examples/complex-multy-step-form-renderer/CreditApplicationFormRenderer';
import RegistrationFormRendererJson from './pages/examples/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson';
import RegistrationForm from './pages/examples/simple-form/RegistrationForm';
import ValidationExamples from './pages/examples/validation/ValidationExamples';
import BehaviorsExamples from './pages/examples/behaviors/BehaviorsExamples';
import McpCreditApplicationV7 from './pages/examples/mcp-credit-application-v7';
import McpCreditApplicationRendererV7 from './pages/examples/mcp-credit-application-renderer-v7';
import McpCreditApplicationRendererJsonV7 from './pages/examples/mcp-credit-application-renderer-json-v7';
type ExamplePage =
  | 'simple'
  | 'validation'
  | 'behaviors'
  | 'complex'
  | 'complex-renderer'
  | 'json-renderer'
  | 'mcp-credit-v7'
  | 'mcp-credit-renderer-v7'
  | 'mcp-credit-renderer-json-v7';

const examples: { id: ExamplePage; path: string; title: string; description: string }[] = [
  {
    id: 'simple',
    path: '/examples/simple',
    title: 'Форма регистрации',
    description: 'Регистрация с асинхронной валидацией, behaviors и маской телефона',
  },
  {
    id: 'complex',
    path: '/examples/complex',
    title: 'Комплексная форма',
    description: 'Многошаговая форма кредитной заявки',
  },
  {
    id: 'complex-renderer',
    path: '/examples/complex-renderer',
    title: 'Комплексная (Renderer)',
    description: 'Та же форма через renderSchema API',
  },
  {
    id: 'json-renderer',
    path: '/examples/json-renderer',
    title: 'JSON Renderer',
    description: 'Рендеринг формы из JSON-схемы через @reformer/renderer-json',
  },
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
    id: 'mcp-credit-v7',
    path: '/examples/mcp-credit-v7',
    title: 'MCP Credit v7 (core)',
    description:
      'Iteration 7: target=core, regression test on patched MCP prompts (incl. wizard hierarchy).',
  },
  {
    id: 'mcp-credit-renderer-v7',
    path: '/examples/mcp-credit-renderer-v7',
    title: 'MCP Credit Renderer v7',
    description: 'Iteration 7: target=renderer-react, regression test on patched MCP prompts.',
  },
  {
    id: 'mcp-credit-renderer-json-v7',
    path: '/examples/mcp-credit-renderer-json-v7',
    title: 'MCP Credit JSON v7',
    description: 'Iteration 7: target=renderer-json, regression test on patched MCP prompts.',
  },
];

// Мемоизированная навигация - не перерисовывается при изменениях в дочерних компонентах
const Navigation = memo(function Navigation() {
  console.debug('Navigation render');
  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto py-2">
          {examples.map((example) => (
            <NavLink
              key={example.id}
              to={example.path}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`
              }
            >
              {example.title}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
});

// Описание текущего примера - зависит от location
function ExampleDescription() {
  const location = useLocation();
  const currentExample = examples.find((e) => location.pathname.startsWith(e.path));

  return (
    <div className="bg-blue-50 border-b border-blue-100">
      <div className="container mx-auto px-4 py-3">
        <p className="text-blue-800 text-sm">{currentExample?.description || 'Выберите пример'}</p>
      </div>
    </div>
  );
}

function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-blue-600">ReFormer Examples</h1>
          <p className="text-gray-500 text-sm">
            Интерактивные примеры использования библиотеки ReFormer
          </p>
        </div>
      </header>

      {/* Navigation */}
      <Navigation />

      {/* Current Example Description */}
      <ExampleDescription />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/examples/simple" element={<RegistrationForm />} />
          <Route path="/examples/validation" element={<ValidationExamples />} />
          <Route path="/examples/behaviors" element={<BehaviorsExamples />} />
          <Route path="/examples/complex" element={<CreditApplicationForm />} />
          <Route path="/examples/complex-renderer" element={<CreditApplicationFormRenderer />} />
          <Route path="/examples/json-renderer" element={<RegistrationFormRendererJson />} />
          <Route path="/examples/mcp-credit-v7" element={<McpCreditApplicationV7 />} />
          <Route
            path="/examples/mcp-credit-renderer-v7"
            element={<McpCreditApplicationRendererV7 />}
          />
          <Route
            path="/examples/mcp-credit-renderer-json-v7"
            element={<McpCreditApplicationRendererJsonV7 />}
          />
          <Route path="/" element={<Navigate to="/examples/simple" replace />} />
          <Route path="*" element={<Navigate to="/examples/simple" replace />} />
        </Routes>
      </main>
      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-gray-500 text-sm">
          ReFormer — Reactive Forms Library |{' '}
          <a
            href="https://github.com/AlexandrBukhtatyy/ReFormer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            GitHub
          </a>
        </div>
      </footer>
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
