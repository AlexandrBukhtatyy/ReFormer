/**
 * Типы для реестра компонентов
 *
 * @module reformer/renderer-json/registry/types
 */

import type { ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ComponentMetadata<P = any> {
  component: ComponentType<P> | unknown;
  type: 'field' | 'container' | 'source';
  description?: string;
}

export interface ComponentRegistry {
  get(name: string): ComponentMetadata | undefined;
  getSource<T = unknown>(name: string): T | undefined;
  has(name: string): boolean;
  names(): string[];
}

export interface RegistryBuilder {
  field<P>(name: string, component: ComponentType<P>, description?: string): void;
  container<P>(name: string, component: ComponentType<P>, description?: string): void;
  source<T>(name: string, value: T, description?: string): void;
}
