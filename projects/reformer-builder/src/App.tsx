import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';

function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 lg:px-6">
          <h1 className="text-xl font-bold text-blue-600">reformer-builder</h1>
          <p className="text-xs text-gray-500">Конструктор форм на ReFormer</p>
        </div>
      </header>

      <main className="container mx-auto w-full flex-1 px-4 py-6 lg:px-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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
