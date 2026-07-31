/**
 * Экран ошибки бутстрапа: рендерится вместо `App`, если переданный клиентом конфиг/каталог
 * невалиден (`RuntimeBundleError`) или бут упал иначе. Намеренно на инлайновых стилях — не зависит
 * от каталога/стора/ui-kit, чтобы отрисоваться при любом сбое инициализации.
 *
 * @module reformer-builder/config/BootError
 */

import { RuntimeBundleError } from './load';

const wrap: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '100vh',
  padding: '24px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  background: '#0b0d10',
  color: '#e6e8eb',
};
const card: React.CSSProperties = {
  maxWidth: '640px',
  width: '100%',
  background: '#14171b',
  border: '1px solid #2a2f36',
  borderRadius: '12px',
  padding: '24px 28px',
};
const pre: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '13px',
  lineHeight: 1.5,
  background: '#0b0d10',
  border: '1px solid #2a2f36',
  borderRadius: '8px',
  padding: '12px 14px',
  marginTop: '12px',
  color: '#ffb4a9',
};

export function BootError({ error }: { error: unknown }) {
  const isBundle = error instanceof RuntimeBundleError;
  const source = isBundle
    ? error.source === 'config'
      ? 'reformer-builder.config.json'
      : 'component-catalog.json'
    : null;
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div style={wrap}>
      <div style={card} role="alert">
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          Не удалось запустить ReFormer Builder
        </h1>
        <p style={{ margin: '10px 0 0', color: '#9aa4af', fontSize: '14px' }}>
          {isBundle
            ? `Переданный клиентом файл ${source} не прошёл валидацию. Исправьте его и перезапустите билдер.`
            : 'Ошибка инициализации при старте.'}
        </p>
        <pre style={pre}>{message}</pre>
      </div>
    </div>
  );
}
