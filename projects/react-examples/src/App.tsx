import { useSignals } from '@preact/signals-react/runtime';
import CreditApplicationForm from './pages/examples/complex-multy-step-form/CreditApplicationForm';

function App() {
  useSignals();
  return (
    <>
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold underline mb-4">Credit form</h1>
        <CreditApplicationForm />
      </div>
    </>
  );
}

export default App;
