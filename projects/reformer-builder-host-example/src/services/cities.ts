/**
 * Словарь городов — из API приложения.
 *
 * Этим сервисом пользуется форма обращения. Его можно править прямо в билдере: после
 * сохранения превью покажет форму с новым словарём.
 *
 * @module services/cities
 */

export interface City {
  readonly id: string;
  readonly name: string;
  readonly region: string;
}

export interface CityOption {
  readonly value: string;
  readonly label: string;
}

export async function loadCityOptions(): Promise<CityOption[]> {
  const response = await fetch('/api/cities');
  if (!response.ok) throw new Error(`Города не загрузились: ответ ${response.status}`);
  const cities = (await response.json()) as City[];
  return cities.map((city) => ({ value: city.id, label: city.name }));
}
