# ReFormer Tests

This directory contains all tests for the ReFormer package. The test structure mirrors the source code structure in `src/` for easy navigation and maintenance.

## Directory Structure

```
tests/
├── core/
│   ├── behavior/           # Behavior system tests
│   │   └── behaviors/      # Individual behavior tests
│   ├── factories/          # Factory function tests
│   ├── nodes/              # Form node tests
│   │   └── group-node/     # Group node sub-module tests
│   ├── types/              # Type definition tests
│   ├── utils/              # Utility function tests
│   └── validation/         # Validation system tests
│       ├── core/           # Core validation logic tests
│       └── validators/     # Individual validator tests
├── hooks/                  # React hooks tests
└── test-utils/             # Common test utilities and helpers
```

## Test Structure Principles

1. **Mirror Source Structure**: Each test file corresponds to a source file with the same relative path
   - Example: `src/core/nodes/field-node.ts` → `tests/core/nodes/field-node.test.ts`

2. **Consolidated Tests**: Related tests for the same module may be split into multiple files if needed
   - Example: `field-node-cleanup.test.ts`, `field-node-error-handling.test.ts`, etc.

3. **Test Utilities**: Common helpers and utilities are in `test-utils/`
   - Import with: `import { mockComponent, delay } from '../test-utils'`

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- field-node.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Test Statistics

- **Total Test Files**: 73
- **Total Tests**: 585+
- **Coverage**: 100% file coverage (all source files have corresponding test files)

## Writing New Tests

When adding a new source file:

1. Create a corresponding test file in the same relative path under `tests/`
2. Use the test utilities from `test-utils/` where applicable
3. Follow the existing test patterns and structure
4. Ensure all tests pass before committing

## Test File Template

```typescript
/**
 * Unit tests for [ModuleName]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { [Module] } from '../../../src/[path]/[module]';

describe('[ModuleName]', () => {
  beforeEach(() => {
    // Setup test environment
  });

  describe('Feature name', () => {
    it('should do something', () => {
      // Test implementation
      expect(true).toBe(true);
    });
  });
});
```

## CI/CD

Tests are automatically run on:

- Pull requests
- Commits to main branch
- Pre-commit hooks (if configured)

All tests must pass before merging.
