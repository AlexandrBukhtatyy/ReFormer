/**
 * Unit tests for URL validator
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/create-form';
import { url } from '../../../../src/core/validation/validators/url';
import type { ValidationSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('url validator', () => {
  interface UrlForm {
    website: string;
  }

  describe('valid URLs', () => {
    const validUrls = [
      'https://example.com',
      'http://example.com',
      'https://www.example.com',
      'https://sub.domain.example.com',
      'https://example.com/path',
      'https://example.com/path/to/page',
      'example.com',
      'www.example.com',
    ];

    it.each(validUrls)('should pass for valid URL: %s', async (validUrl) => {
      const form = makeForm<UrlForm>({
        website: { value: validUrl, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    const invalidUrls = ['not-a-url', 'ftp://invalid', 'just text', '://missing-protocol.com'];

    it.each(invalidUrls)('should fail for invalid URL: %s', async (invalidUrl) => {
      const form = makeForm<UrlForm>({
        website: { value: invalidUrl, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(false);
      expect(form.website.errors.value[0].code).toBe('url');
    });
  });

  describe('requireProtocol option', () => {
    it('should fail when protocol is required but missing', async () => {
      const form = makeForm<UrlForm>({
        website: { value: 'example.com', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website, { requireProtocol: true });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(false);
    });

    it('should pass when protocol is required and present', async () => {
      const form = makeForm<UrlForm>({
        website: { value: 'https://example.com', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website, { requireProtocol: true });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(true);
    });
  });

  describe('allowedProtocols option', () => {
    it('should pass when using allowed protocol', async () => {
      const form = makeForm<UrlForm>({
        website: { value: 'https://example.com', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website, { allowedProtocols: ['https'] });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(true);
    });

    it('should fail when using non-allowed protocol', async () => {
      const form = makeForm<UrlForm>({
        website: { value: 'http://example.com', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website, { allowedProtocols: ['https'] });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(false);
      expect(form.website.errors.value[0].code).toBe('url_protocol');
    });

    it('should include allowedProtocols in error params', async () => {
      const form = makeForm<UrlForm>({
        website: { value: 'http://example.com', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website, { allowedProtocols: ['https', 'ftp'] });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.errors.value[0].params?.allowedProtocols).toEqual(['https', 'ftp']);
    });
  });

  describe('empty values', () => {
    it('should pass for empty string (use required for mandatory)', async () => {
      const form = makeForm<UrlForm>({
        website: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.valid.value).toBe(true);
    });

    it('should pass for null', async () => {
      interface NullableForm {
        link: string | null;
      }

      const form = makeForm<NullableForm>({
        link: { value: null, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<NullableForm> = (path: FieldPath<NullableForm>) => {
        url(path.link);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.link.valid.value).toBe(true);
    });
  });

  describe('custom message', () => {
    it('should use custom message', async () => {
      const form = makeForm<UrlForm>({
        website: { value: 'invalid', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<UrlForm> = (path: FieldPath<UrlForm>) => {
        url(path.website, { message: 'Please enter a valid website URL' });
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.website.errors.value[0].message).toBe('Please enter a valid website URL');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fieldPath', () => {
      expect(() => url(undefined)).not.toThrow();
    });
  });
});
