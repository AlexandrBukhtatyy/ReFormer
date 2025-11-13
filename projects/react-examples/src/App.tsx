import { Button } from './components/ui/button';
import CreditApplicationForm from './pages/examples/complex-multy-step-form/CreditApplicationForm';

function App() {
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
