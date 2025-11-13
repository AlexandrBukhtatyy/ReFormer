import { GroupNode } from '../nodes/group-node';
import type { GroupNodeWithControls } from '../types';

export function makeForm<T extends Record<string, any>>(form: GroupNodeWithControls<T>) {
  return new GroupNode<T>(form) as GroupNodeWithControls<T>;
}
