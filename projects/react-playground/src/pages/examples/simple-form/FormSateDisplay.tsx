import { useEffect, useState } from 'react';
import type { GroupNode } from 'reformer';

// Компонент отображения состояния формы (реактивный)
// Подписывается на изменения внутри, чтобы не вызывать ре-рендер родителя
export function FormStateDisplay({ form }: { form: GroupNode<unknown> }) {
  const [state, setState] = useState(() => form.value.value);

  useEffect(() => {
    // Подписываемся на изменения значения формы
    return form.value.subscribe(setState);
  }, [form]);

  return (
    <pre className="p-4 bg-gray-100 rounded text-sm overflow-auto max-h-96">
      {JSON.stringify(state, null, 2)}
    </pre>
  );
}