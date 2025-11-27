import { CreditApplicationForm } from '@/components/CreditApplicationForm';

function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Credit Application Form</h1>
        <CreditApplicationForm />
      </div>
    </div>
  );
}

export default App;
