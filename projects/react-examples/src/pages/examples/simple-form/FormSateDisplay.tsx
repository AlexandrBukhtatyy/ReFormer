// Компонент отображения состояния формы (реактивный)
export function FormStateDisplay({ form }: { form: unknown }) {
  return (
    <pre className="p-4 bg-gray-100 rounded text-sm overflow-auto max-h-96">
      {JSON.stringify(form, null, 2)}
    </pre>
  );
}
