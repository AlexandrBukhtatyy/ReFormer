interface SectionProps {
  title?: string;
  children?: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="rounded-lg border border-gray-200 p-6 space-y-4">
      {title && <h2 className="text-lg font-semibold text-gray-800">{title}</h2>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
