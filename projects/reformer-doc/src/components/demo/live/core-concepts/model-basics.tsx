import { useState, useSyncExternalStore } from 'react';
import { createModel, type FormModel } from '@reformer/core';
import type { ReadonlySignal } from '@reformer/core/signals';
import { Button, Input, Label } from '@reformer/ui-kit';

type Profile = { name: string; address: { city: string } };

// Начальные значения — точка отсчёта модели: к ним вернёт сброс.
const initialProfile = (): Profile => ({ name: '', address: { city: '' } });

// Модель — не состояние React: её меняют напрямую, а компонент узнаёт об изменении из подписки.
const writeName = (model: FormModel<Profile>, name: string) => {
  model.$.name.value = name; // запись через сигнал поля
};
const writeCity = (model: FormModel<Profile>, city: string) => {
  model.address.city = city; // запись присваиванием — тот же сигнал model.$.address.city
};

// Значение сигнала для React: подписка на сигнал и снимок его значения.
function useSignalValue<T>(source: ReadonlySignal<T>): T {
  return useSyncExternalStore(
    (onChange) => source.subscribe(() => onChange()),
    () => source.peek(),
    () => source.peek()
  );
}

export default function ModelBasics() {
  // Модель создаётся один раз: ленивый useState не пересоздаёт её при перерисовке.
  const [model] = useState(() => createModel<Profile>(initialProfile()));

  // Корень model.$ — сигнал всей модели: любая правка поля перерисует компонент.
  const profile = useSignalValue(model.$);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="model-basics-name">Имя</Label>
        <Input
          id="model-basics-name"
          value={profile.name}
          onChange={(event) => writeName(model, event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="model-basics-city">Город</Label>
        <Input
          id="model-basics-city"
          value={profile.address.city}
          onChange={(event) => writeCity(model, event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          // patch пишет только переданные поля: имя останется прежним.
          onClick={() => model.patch({ address: { city: 'Казань' } })}
        >
          Город — Казань
        </Button>
        <Button type="button" variant="outline" onClick={() => model.reset()}>
          Сбросить
        </Button>
      </div>
      {/* model.get() — снимок всех значений без подписки; свежий, потому что компонент
          перерисовала подписка выше. */}
      <pre className="m-0 rounded-md border p-3 text-sm">
        {JSON.stringify(model.get(), null, 2)}
      </pre>
      <p className="m-0 text-sm">Изменена: {model.isDirty() ? 'да' : 'нет'}</p>
    </div>
  );
}
