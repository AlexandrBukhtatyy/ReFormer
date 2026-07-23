import { describe, it, expect } from 'vitest';
import { fileUploadBasePropsSchema } from './variants/base/file-upload-base.props';
import { fileUploadAvatarPropsSchema } from './variants/avatar/file-upload-avatar.props';
import type { FileUploadBaseProps } from './variants/base/file-upload-base';
import type { FileUploadAvatarProps } from './variants/avatar/file-upload-avatar';

/**
 * Страж от дрейфа props-схем FileUpload. Направление A (ключи схемы ⊆ props варианта):
 * ловит опечатки и чужие ключи. `variant` — ключ ДИСПЕТЧЕРА (FileUploadField), в props
 * варианта его нет — исключается явно.
 */

type Assert<T extends true> = T;

type BaseSchemaKeys =
  | Exclude<keyof typeof fileUploadBasePropsSchema.properties, 'variant'>
  | keyof (typeof fileUploadBasePropsSchema)['x-runtimeProps'];
type _A_Base = Assert<BaseSchemaKeys extends keyof FileUploadBaseProps ? true : false>;

type AvatarSchemaKeys =
  | keyof typeof fileUploadAvatarPropsSchema.properties
  | keyof (typeof fileUploadAvatarPropsSchema)['x-runtimeProps'];
type _A_Avatar = Assert<AvatarSchemaKeys extends keyof FileUploadAvatarProps ? true : false>;

describe('file-upload props-схемы — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅', () => {
    for (const schema of [fileUploadBasePropsSchema, fileUploadAvatarPropsSchema]) {
      const propKeys = Object.keys(schema.properties);
      const runtimeKeys = Object.keys(schema['x-runtimeProps']);
      expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
    }
  });

  it('registry-имена: FileUpload (диспетчер) и FileUploadAvatar (single)', () => {
    expect(fileUploadBasePropsSchema['x-registryName']).toBe('FileUpload');
    expect(fileUploadAvatarPropsSchema['x-registryName']).toBe('FileUploadAvatar');
  });

  it('variant enum соответствует диспетчеру FileUploadField', () => {
    expect(fileUploadBasePropsSchema.properties.variant.enum).toEqual([
      'button',
      'dropzone',
      'input',
    ]);
    expect(fileUploadBasePropsSchema.properties.variant.default).toBe('button');
  });

  it('invalid объявлен в обеих схемах (State)', () => {
    expect(fileUploadBasePropsSchema.properties.invalid.type).toBe('boolean');
    expect(fileUploadAvatarPropsSchema.properties.invalid.type).toBe('boolean');
  });

  it('avatar: accept по умолчанию image/*, shape circle', () => {
    expect(fileUploadAvatarPropsSchema.properties.accept.default).toBe('image/*');
    expect(fileUploadAvatarPropsSchema.properties.shape.default).toBe('circle');
  });
});
