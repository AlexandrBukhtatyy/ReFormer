---
sidebar_position: 4
---

# Управление черновиками

Создание, загрузка и управление несколькими черновиками формы.

## Что мы строим

Полная система управления черновиками:

- **Создание** именованных черновиков
- **Список** всех сохранённых черновиков
- **Загрузка** конкретного черновика
- **Обновление** текущего черновика
- **Удаление** ненужных черновиков
- **Автосохранение** в активный черновик
- **Переключение** между черновиками

## Почему управление черновиками?

Пользователи часто нуждаются в:

- **Сохранение прогресса** перед уходом
- **Возобновление позже** с любого устройства
- **Сравнение вариантов** сохраняя несколько сценариев
- **Обмен черновиками** с соавторами
- **Отслеживание истории** изменений

Пример: Пользователь может создать черновики для:

- "Консервативный кредит" - Меньшая сумма, безопаснее
- "Агрессивный кредит" - Большая сумма, рискованнее
- "С сокредитором" - Совместное заявление
- "Индивидуальное заявление" - Одиночное заявление

## Структура данных черновика

Сначала определим интерфейс черновика:

```typescript title="src/types/draft.ts"
/**
 * Метаданные и данные черновика
 */
export interface Draft {
  /** Уникальный ID черновика */
  id: string;
  /** Имя, предоставленное пользователем */
  name: string;
  /** Данные формы */
  data: any;
  /** Метка времени создания */
  createdAt: number;
  /** Метка времени последнего обновления */
  updatedAt: number;
  /** Опциональное описание */
  description?: string;
  /** Статус черновика */
  status?: 'draft' | 'submitted';
}

/**
 * Входные данные для создания черновика
 */
export interface CreateDraftInput {
  name: string;
  data: any;
  description?: string;
}

/**
 * Входные данные для обновления черновика
 */
export interface UpdateDraftInput {
  name?: string;
  data?: any;
  description?: string;
}
```

## Расширенный сервис хранения черновиков

Расширим сервис localStorage полными операциями CRUD:

```typescript title="src/services/storage/draft.storage.ts"
import type { Draft, CreateDraftInput, UpdateDraftInput } from '@/types/draft.types';

const DRAFTS_KEY = 'credit-application-drafts';
const CURRENT_DRAFT_ID_KEY = 'credit-application-current-draft-id';

/**
 * Получение всех черновиков
 */
export function getAllDrafts(): Draft[] {
  try {
    const data = localStorage.getItem(DRAFTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Ошибка получения черновиков:', error);
    return [];
  }
}

/**
 * Получение черновика по ID
 */
export function getDraftById(id: string): Draft | null {
  const drafts = getAllDrafts();
  return drafts.find((d) => d.id === id) || null;
}

/**
 * Создание нового черновика
 */
export function createDraft(input: CreateDraftInput): Draft {
  const drafts = getAllDrafts();

  const newDraft: Draft = {
    id: generateDraftId(),
    name: input.name,
    data: input.data,
    description: input.description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'draft',
  };

  drafts.push(newDraft);
  saveDrafts(drafts);

  return newDraft;
}

/**
 * Обновление существующего черновика
 */
export function updateDraft(id: string, input: UpdateDraftInput): Draft | null {
  const drafts = getAllDrafts();
  const index = drafts.findIndex((d) => d.id === id);

  if (index === -1) {
    return null;
  }

  const draft = drafts[index];
  drafts[index] = {
    ...draft,
    ...input,
    updatedAt: Date.now(),
  };

  saveDrafts(drafts);
  return drafts[index];
}

/**
 * Удаление черновика
 */
export function deleteDraft(id: string): boolean {
  const drafts = getAllDrafts();
  const filtered = drafts.filter((d) => d.id !== id);

  if (filtered.length === drafts.length) {
    return false; // Черновик не найден
  }

  saveDrafts(filtered);

  // Очищаем текущий ID черновика если он был удалён
  if (getCurrentDraftId() === id) {
    clearCurrentDraftId();
  }

  return true;
}

/**
 * Получение текущего ID черновика
 */
export function getCurrentDraftId(): string | null {
  return localStorage.getItem(CURRENT_DRAFT_ID_KEY);
}

/**
 * Установка текущего ID черновика
 */
export function setCurrentDraftId(id: string): void {
  localStorage.setItem(CURRENT_DRAFT_ID_KEY, id);
}

/**
 * Очистка текущего ID черновика
 */
export function clearCurrentDraftId(): void {
  localStorage.removeItem(CURRENT_DRAFT_ID_KEY);
}

/**
 * Получение текущего черновика
 */
export function getCurrentDraft(): Draft | null {
  const id = getCurrentDraftId();
  return id ? getDraftById(id) : null;
}

/**
 * Сохранение массива черновиков в хранилище
 */
function saveDrafts(drafts: Draft[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Ошибка сохранения черновиков:', error);
    throw error;
  }
}

/**
 * Генерирование уникального ID черновика
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Дублирование черновика
 */
export function duplicateDraft(id: string, newName: string): Draft | null {
  const original = getDraftById(id);
  if (!original) {
    return null;
  }

  return createDraft({
    name: newName,
    data: { ...original.data },
    description: `Копия ${original.name}`,
  });
}

/**
 * Поиск черновиков по имени
 */
export function searchDrafts(query: string): Draft[] {
  const drafts = getAllDrafts();
  const lowerQuery = query.toLowerCase();

  return drafts.filter(
    (draft) =>
      draft.name.toLowerCase().includes(lowerQuery) ||
      draft.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Получение черновиков, отсортированных по времени обновления
 */
export function getDraftsSortedByUpdate(): Draft[] {
  const drafts = getAllDrafts();
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}
```

## Создание хука useDraftManager

Создадим комплексный хук для управления черновиками:

```typescript title="src/hooks/useDraftManager.ts"
import { useState, useEffect, useCallback } from 'react';
import type { FormNode } from 'reformer';
import type { Draft, CreateDraftInput, UpdateDraftInput } from '@/types/draft.types';
import {
  getAllDrafts,
  getDraftById,
  createDraft,
  updateDraft,
  deleteDraft,
  getCurrentDraftId,
  setCurrentDraftId,
  clearCurrentDraftId,
  duplicateDraft,
  getDraftsSortedByUpdate,
} from '@/services/storage/draft.storage';

/**
 * Тип возврата хука
 */
export interface UseDraftManagerReturn {
  /** Все черновики */
  drafts: Draft[];
  /** ID текущего активного черновика */
  currentDraftId: string | null;
  /** Текущий активный черновик */
  currentDraft: Draft | null;
  /** Создание нового черновика */
  create: (name: string, description?: string) => Draft;
  /** Загрузка черновика в форму */
  load: (id: string) => void;
  /** Обновление текущего черновика */
  updateCurrent: (input: UpdateDraftInput) => void;
  /** Удаление черновика */
  remove: (id: string) => void;
  /** Дублирование черновика */
  duplicate: (id: string, newName: string) => Draft | null;
  /** Обновление списка черновиков */
  refresh: () => void;
  /** Сохранение текущей формы как нового черновика */
  saveAsNew: (name: string, description?: string) => Draft;
  /** Очистка текущего черновика */
  clearCurrent: () => void;
}

/**
 * Хук для управления черновиками формы
 */
export function useDraftManager(form: FormNode): UseDraftManagerReturn {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftIdState] = useState<string | null>(null);

  // Загрузка черновиков при монтировании
  useEffect(() => {
    refresh();
    setCurrentDraftIdState(getCurrentDraftId());
  }, []);

  // Обновление списка черновиков
  const refresh = useCallback(() => {
    setDrafts(getDraftsSortedByUpdate());
  }, []);

  // Получение текущего черновика
  const currentDraft = drafts.find((d) => d.id === currentDraftId) || null;

  // Создание нового черновика из текущих данных формы
  const create = useCallback(
    (name: string, description?: string): Draft => {
      const draft = createDraft({
        name,
        data: form.value.value,
        description,
      });

      setCurrentDraftId(draft.id);
      setCurrentDraftIdState(draft.id);
      refresh();

      return draft;
    },
    [form, refresh]
  );

  // Загрузка черновика в форму
  const load = useCallback(
    (id: string) => {
      const draft = getDraftById(id);
      if (!draft) {
        console.error('Чёрновик не найден:', id);
        return;
      }

      form.patchValue(draft.data);
      setCurrentDraftId(id);
      setCurrentDraftIdState(id);
    },
    [form]
  );

  // Обновление текущего черновика
  const updateCurrent = useCallback(
    (input: UpdateDraftInput) => {
      if (!currentDraftId) {
        console.warn('Нет текущего черновика для обновления');
        return;
      }

      updateDraft(currentDraftId, input);
      refresh();
    },
    [currentDraftId, refresh]
  );

  // Удаление черновика
  const remove = useCallback(
    (id: string) => {
      const success = deleteDraft(id);
      if (success) {
        if (currentDraftId === id) {
          setCurrentDraftIdState(null);
        }
        refresh();
      }
    },
    [currentDraftId, refresh]
  );

  // Дублирование черновика
  const duplicateHandler = useCallback(
    (id: string, newName: string): Draft | null => {
      const newDraft = duplicateDraft(id, newName);
      if (newDraft) {
        refresh();
      }
      return newDraft;
    },
    [refresh]
  );

  // Сохранение текущей формы как нового черновика
  const saveAsNew = useCallback(
    (name: string, description?: string): Draft => {
      return create(name, description);
    },
    [create]
  );

  // Очистка текущего черновика
  const clearCurrent = useCallback(() => {
    clearCurrentDraftId();
    setCurrentDraftIdState(null);
  }, []);

  return {
    drafts,
    currentDraftId,
    currentDraft,
    create,
    load,
    updateCurrent,
    remove,
    duplicate: duplicateHandler,
    refresh,
    saveAsNew,
    clearCurrent,
  };
}
```

## Создание UI компонента выбора черновика

Создадим компонент для выбора и управления черновиками:

```tsx title="src/components/DraftSelector.tsx"
import { useState } from 'react';
import type { Draft } from '@/types/draft.types';

interface DraftSelectorProps {
  drafts: Draft[];
  currentDraftId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string, newName: string) => void;
  onCreateNew: (name: string, description?: string) => void;
}

export function DraftSelector({
  drafts,
  currentDraftId,
  onLoad,
  onDelete,
  onDuplicate,
  onCreateNew,
}: DraftSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="draft-selector">
      {/* Отображение текущего черновика */}
      <button onClick={() => setIsOpen(!isOpen)} className="draft-selector-button">
        <FolderIcon className="w-5 h-5" />
        <span>
          {currentDraftId
            ? drafts.find((d) => d.id === currentDraftId)?.name || 'Без названия'
            : 'Черновик не выбран'}
        </span>
        <ChevronIcon className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Выпадающее меню */}
      {isOpen && (
        <div className="draft-selector-menu">
          {/* Список черновиков */}
          <div className="draft-list">
            {drafts.length === 0 ? (
              <div className="empty-state">
                <p>Нет сохранённых черновиков</p>
              </div>
            ) : (
              drafts.map((draft) => (
                <DraftItem
                  key={draft.id}
                  draft={draft}
                  isActive={draft.id === currentDraftId}
                  onLoad={() => {
                    onLoad(draft.id);
                    setIsOpen(false);
                  }}
                  onDelete={() => {
                    if (confirm(`Удалить черновик "${draft.name}"?`)) {
                      onDelete(draft.id);
                    }
                  }}
                  onDuplicate={() => {
                    const newName = prompt('Введите имя дубликата:', `${draft.name} (копия)`);
                    if (newName) {
                      onDuplicate(draft.id, newName);
                    }
                  }}
                />
              ))
            )}
          </div>

          {/* Кнопка создания нового */}
          <div className="draft-selector-footer">
            <button onClick={() => setShowCreateDialog(true)} className="create-draft-button">
              <PlusIcon className="w-4 h-4" />
              <span>Сохранить как новый черновик</span>
            </button>
          </div>
        </div>
      )}

      {/* Диалог создания черновика */}
      {showCreateDialog && (
        <CreateDraftDialog
          onConfirm={(name, description) => {
            onCreateNew(name, description);
            setShowCreateDialog(false);
            setIsOpen(false);
          }}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

interface DraftItemProps {
  draft: Draft;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function DraftItem({ draft, isActive, onLoad, onDelete, onDuplicate }: DraftItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`draft-item ${isActive ? 'active' : ''}`}>
      <button onClick={onLoad} className="draft-item-button">
        <div className="draft-item-content">
          <div className="draft-item-name">{draft.name}</div>
          {draft.description && <div className="draft-item-description">{draft.description}</div>}
          <div className="draft-item-meta">
            <span>{formatDate(draft.updatedAt)}</span>
          </div>
        </div>
      </button>

      {/* Меню действий */}
      <div className="draft-item-actions">
        <button onClick={() => setShowMenu(!showMenu)} className="draft-item-menu-button">
          <DotsIcon className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="draft-item-menu">
            <button onClick={onDuplicate}>
              <CopyIcon className="w-4 h-4" />
              <span>Дублировать</span>
            </button>
            <button onClick={onDelete} className="text-red-600">
              <TrashIcon className="w-4 h-4" />
              <span>Удалить</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface CreateDraftDialogProps {
  onConfirm: (name: string, description?: string) => void;
  onCancel: () => void;
}

function CreateDraftDialog({ onConfirm, onCancel }: CreateDraftDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim(), description.trim() || undefined);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Сохранить черновик</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="draft-name">Имя черновика</label>
            <input
              id="draft-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="например, Консервативный кредит"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="draft-description">Описание (опционально)</label>
            <textarea
              id="draft-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительные примечания об этом черновике"
              rows={3}
            />
          </div>

          <div className="dialog-actions">
            <button type="button" onClick={onCancel}>
              Отмена
            </button>
            <button type="submit" disabled={!name.trim()}>
              Сохранить черновик
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Вспомогательные функции
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} час${diffHours > 1 ? 'ов' : ''} назад`;
  if (diffDays < 7) return `${diffDays} дн${diffDays > 1 ? 'ей' : ''} назад`;

  return date.toLocaleDateString();
}

// Компоненты иконок (используйте вашу предпочитаемую библиотеку иконок)
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
      <path strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
```

## Интеграция с автосохранением

Интегрируем управление черновиками с автосохранением:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useEffect } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftManager } from '@/hooks/useDraftManager';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';

export function CreditApplicationForm() {
  // Создание формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Управление черновиками
  const draftManager = useDraftManager(form);

  // Автосохранение в текущий черновик
  const { status } = useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => {
      if (draftManager.currentDraftId) {
        // Обновление существующего черновика
        draftManager.updateCurrent({ data });
      } else {
        // Создание нового черновика с меткой времени
        const name = `Автосохранено ${new Date().toLocaleString()}`;
        draftManager.create(name);
      }
    },
  });

  // Загрузка начального черновика при монтировании
  useEffect(() => {
    if (draftManager.currentDraftId) {
      draftManager.load(draftManager.currentDraftId);
    }
  }, []);

  return (
    <div className="form-container">
      {/* Заголовок с управлением */}
      <div className="form-header">
        <h1>Кредитное заявление</h1>
        <div className="form-controls">
          <AutoSaveIndicator status={status} />
          <DraftSelector
            drafts={draftManager.drafts}
            currentDraftId={draftManager.currentDraftId}
            onLoad={draftManager.load}
            onDelete={draftManager.remove}
            onDuplicate={draftManager.duplicate}
            onCreateNew={draftManager.create}
          />
        </div>
      </div>

      {/* Форма */}
      <FormRenderer form={form} />
    </div>
  );
}
```

## Тестирование управления черновиками

Протестируйте эти сценарии:

### Сценарий 1: Создание черновика

- [ ] Заполните форму с данными
- [ ] Нажмите "Сохранить как новый черновик"
- [ ] Введите имя черновика
- [ ] Черновик появляется в списке
- [ ] Черновик установлен как текущий

### Сценарий 2: Загрузка черновика

- [ ] Имеется несколько черновиков
- [ ] Выберите черновик из списка
- [ ] Форма загружается с данными черновика
- [ ] Индикатор текущего черновика обновляется

### Сценарий 3: Обновление черновика

- [ ] Загрузите черновик
- [ ] Измените данные формы
- [ ] Подождите автосохранения
- [ ] Перезагрузите страницу
- [ ] Изменения сохранены

### Сценарий 4: Удаление черновика

- [ ] Выберите черновик
- [ ] Нажмите удалить
- [ ] Подтвердите удаление
- [ ] Черновик удалён из списка
- [ ] Текущий черновик очищен если был удалён

### Сценарий 5: Дублирование черновика

- [ ] Выберите черновик
- [ ] Нажмите дублировать
- [ ] Введите новое имя
- [ ] Создан новый черновик
- [ ] Оба черновика в списке

### Сценарий 6: Переключение между черновиками

- [ ] Черновик A загружен
- [ ] Заполните несколько полей
- [ ] Переключитесь на черновик B
- [ ] Форма обновляется с данными черновика B
- [ ] Переключитесь обратно на черновик A
- [ ] Исходные данные восстановлены

## Ключевые выводы

1. **Операции CRUD** - Создание, чтение, обновление, удаление черновиков
2. **Текущий черновик** - Отслеживание того, какой черновик активен
3. **Интеграция автосохранения** - Автосохранение обновляет текущий черновик
4. **UI компоненты** - Дружественное к пользователю управление черновиками
5. **localStorage** - Постоянное хранилище на клиентской стороне
6. **Метаданные черновика** - Имена, описания, метки времени

## Распространённые паттерны

### Создание черновика

```typescript
const draft = draftManager.create('Мой черновик', 'Опциональное описание');
```

### Загрузка черновика

```typescript
draftManager.load(draftId);
```

### Обновление текущего черновика

```typescript
draftManager.updateCurrent({ data: form.value.value });
```

### Удаление черновика

```typescript
draftManager.remove(draftId);
```

### Получение всех черновиков

```typescript
const drafts = draftManager.drafts;
```

## Что дальше?

В следующем разделе мы добавим функцию **Сброс и очистка**:

- Возврат к исходным значениям
- Очистка всех данных формы
- Сброс определённых этапов
- Диалоги подтверждения
- Интеграция с черновиками

Пользователи смогут сбросить свою работу и начать заново!
