/**
 * React-слой реестра форм.
 *
 * Выделен в отдельный subpath: ядро (`@reformer/form-registry`) React-free и работает
 * в vanilla-хосте, в web-компоненте и в node-тестах разрешения.
 *
 * @module reformer/form-registry/react
 */

export { FormRegistryProvider, useFormRegistryContext } from './context';
export type {
  FormRegistryProviderProps,
  FormRegistryContextValue,
  FormRegistryOptions,
} from './context';

export { FormOutlet, FormSlot, FormRoute } from './form-outlet';
export type { FormOutletProps, FormMountProps } from './form-outlet';

export { MountedForm } from './mounted-form';
export type { MountedFormProps } from './mounted-form';

export { useFormResource } from './use-form-resource';
export type { FormResource } from './use-form-resource';
