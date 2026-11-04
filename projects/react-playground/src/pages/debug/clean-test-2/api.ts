/** Mock API отправки заявки (задержка 2 секунды). */
export async function submitApplication(data: unknown): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('Заявка отправлена', data);
  alert('Заявка успешно отправлена');
}
