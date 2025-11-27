import { memo } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import CreditApplicationForm from './pages/examples/complex-multy-step-form/CreditApplicationForm';
import RegistrationForm from './pages/examples/simple-form/RegistrationForm';
import ValidationExamples from './pages/examples/validation/ValidationExamples';
import BehaviorsExamples from './pages/examples/behaviors/BehaviorsExamples';
import Playground from './pages/examples/playground/Playground';

type ExamplePage = 'simple' | 'validation' | 'behaviors' | 'complex' | 'playground';

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
    id: 'validation',
    path: '/examples/validation',
    title: 'Валидация',
    description: 'Встроенные валидаторы',
  },
  {
    id: 'behaviors',
    path: '/examples/behaviors',
    title: 'Поведения',
    description: 'computeFrom, enableWhen и условная логика',
  },
  {
    id: 'playground',
    path: '/examples/playground',
    title: 'Песочница',
    description: 'Страница для эксперементов',
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
          <Route path="/examples/playground" element={<Playground />} />
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
