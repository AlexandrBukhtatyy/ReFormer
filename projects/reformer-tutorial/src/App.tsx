import CreditApplicationForm from './forms/credit-application/CreditApplicationForm';

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center py-6">
      <CreditApplicationForm applicationId="test-123" />
    </div>
  );
}

export default App;
