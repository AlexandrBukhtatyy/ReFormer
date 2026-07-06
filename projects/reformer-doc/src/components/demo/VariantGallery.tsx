import { ApiPreview } from './ApiPreview';
import type { VariantDef } from './types';
import styles from './styles.module.css';

/** Таб Variants: адаптивный грид карточек-пресетов. */
export function VariantGallery({ variants }: { variants: VariantDef[] }) {
  return (
    <div className={styles.gallery}>
      {variants.map((v) => (
        <VariantCard key={v.id} variant={v} />
      ))}
    </div>
  );
}

function VariantCard({ variant }: { variant: VariantDef }) {
  const Render = variant.render;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.cardTitle}>{variant.title}</p>
      </div>
      <ApiPreview
        minimal
        hint={variant.hint ?? variant.description}
        showFooter={false}
        codeFlavors={[
          { id: 'code', label: 'Code', language: variant.language, code: variant.code },
        ]}
      >
        <Render />
      </ApiPreview>
    </div>
  );
}
