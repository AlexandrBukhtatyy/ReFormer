import { GroupNode } from '../nodes/group-node';
import type { GroupNodeWithControls, FormFields } from '../types';

export function makeForm<T extends FormFields>(form: GroupNodeWithControls<T>) {
  return new GroupNode<T>(form) as GroupNodeWithControls<T>;
}
