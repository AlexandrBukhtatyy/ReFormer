import * as React from 'react';

// Дословный порт shadcn/ui (new-york-v4) hook `use-mobile` (registryDependency sidebar).
// Правки только: снят 'use client'. Живёт локально в каталоге sidebar, т.к. это единственный
// потребитель (нет общего src/hooks). matchMedia-подписка на mobile-брейкпоинт (768px).
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
