import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import CreditApplicationForm from './pages/examples/complex-multy-step-form/CreditApplicationForm';
import SimpleForm from './pages/examples/simple-form/SimpleForm';
import ValidationExamples from './pages/examples/validation/ValidationExamples';
import BehaviorsExamples from './pages/examples/behaviors/BehaviorsExamples';

type ExamplePage =
  | 'simple'
  | 'validation'
  | 'behaviors'
  | 'complex';

const examples: { id: ExamplePage; title: string; description: string }[] = [
  {
    id: 'simple',
    title: 'Простая форма',
    description: 'Базовый пример с GroupNode и FieldNode',
  },
  {
    id: 'validation',
    title: 'Валидация',
    description: 'Встроенные валидаторы',
  },
  {
    id: 'behaviors',
    title: 'Поведения',
    description: 'computeFrom, enableWhen и условная логика',
  },
  {
    id: 'complex',
    title: 'Комплексная форма',
    description: 'Многошаговая форма кредитной заявки',
  },
];

function App() {
  useSignals();
  const [currentPage, setCurrentPage] = useState<ExamplePage>('simple');

  const renderPage = () => {
    switch (currentPage) {
      case 'simple':
        return <SimpleForm />;
      case 'validation':
        return <ValidationExamples />;
      case 'behaviors':
        return <BehaviorsExamples />;
      case 'complex':
        return <CreditApplicationForm />;
      default:
        return <SimpleForm />;
    }
  };

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
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {examples.map((example) => (
              <button
                key={example.id}
                onClick={() => setCurrentPage(example.id)}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  currentPage === example.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Current Example Description */}
      <div className="bg-blue-50 border-b border-blue-100">
        <div className="container mx-auto px-4 py-3">
          <p className="text-blue-800 text-sm">
            {examples.find((e) => e.id === currentPage)?.description}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {renderPage()}
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

export default App;
