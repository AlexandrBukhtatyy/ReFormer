# Test Utilities

This directory contains common utilities, helpers, and mock data used across tests in the ReFormer package.

## Contents

- `index.ts` - Main test utilities file containing:
  - Mock components
  - Common test interfaces
  - Async helpers (delay, nextTick)
  - Mock validators

## Usage

Import utilities in your test files:

```typescript
import { mockComponent, delay, TestFormBasic } from '../test-utils';
```

Or from the root of tests:

```typescript
import { mockComponent, delay } from '../../test-utils';
```

## Adding New Utilities

When you find yourself repeating code across multiple test files, consider extracting it to this utilities directory.
