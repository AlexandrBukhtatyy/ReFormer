import { useEffect, useState } from 'react';
import type { FieldNode } from '../core/nodes/field-node';

export const useFormControl = (control: FieldNode) => {
  const [value, setValue] = useState(control.value.value);
  const [errors, setErrors] = useState(control.errors.value);
  const [pending, setPending] = useState(control.pending.value);
  const [disabled, setDisabled] = useState(control.disabled.value);

  // Подписка на сигналы для обновления состояния компонента
  useEffect(() => {
    const unsubscribeValue = control.value.subscribe((newValue) => setValue(newValue));
    const unsubscribeErrors = control.errors.subscribe((newErrors) => setErrors(newErrors));
    const unsubscribePending = control.pending.subscribe((newPending) => setPending(newPending));
    const unsubscribeDisabled = control.disabled.subscribe((newDisabled) =>
      setDisabled(newDisabled)
    );

    // Очистка подписок при размонтировании компонента
    return () => {
      unsubscribeValue();
      unsubscribeErrors();
      unsubscribePending();
      unsubscribeDisabled();
    };
  }, [control]);

  return { value, errors, pending, disabled };
};
