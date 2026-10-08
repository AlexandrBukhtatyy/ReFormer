/**
 * Обращения — приём на стороне API приложения.
 *
 * @module services/contact-requests
 */

export interface ContactRequest {
  readonly name: string;
  readonly email: string;
  readonly city: string | null;
}

/** Отправляет обращение; отвечает его номером. */
export async function sendContactRequest(request: ContactRequest): Promise<{ id: string }> {
  const response = await fetch('/api/contact-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Обращение не принято: ответ ${response.status}`);
  return (await response.json()) as { id: string };
}
