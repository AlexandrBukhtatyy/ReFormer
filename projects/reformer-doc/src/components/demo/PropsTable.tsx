import type { PropRow } from './types';

/** Таблица props компонента (таб API). Использует дефолтную стилизацию таблиц Infima. */
export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Prop</th>
          <th>Тип</th>
          <th>По умолчанию</th>
          <th>Описание</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>
              <code>{r.name}</code>
            </td>
            <td>
              <code>{r.type}</code>
            </td>
            <td>{r.default ? <code>{r.default}</code> : '—'}</td>
            <td>{r.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
