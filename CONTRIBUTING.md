# Contributing to Reformer

Thank you for your interest in contributing to Reformer! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ReFormer.git
   cd ReFormer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the library:
   ```bash
   npm run build -w reformer
   ```
5. Run tests:
   ```bash
   npm run test -w reformer
   ```

## Development Workflow

### Branch Naming

- `feat/description` - for new features
- `fix/description` - for bug fixes
- `docs/description` - for documentation changes
- `refactor/description` - for code refactoring

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Your commit messages should follow this format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - new feature
- `fix` - bug fix
- `docs` - documentation changes
- `style` - code style changes (formatting, etc.)
- `refactor` - code refactoring
- `perf` - performance improvements
- `test` - adding or updating tests
- `build` - build system changes
- `ci` - CI/CD changes
- `chore` - other changes

**Scopes:**
- `reformer` - core library
- `docs` - documentation
- `ci` - CI/CD
- `deps` - dependencies

**Examples:**
```
feat(reformer): add new validation rule for phone numbers
fix(reformer): resolve race condition in async validation
docs: update installation instructions
```

### Pull Request Process

1. Create a new branch from `develop`
2. Make your changes
3. Ensure all tests pass: `npm run test -w reformer`
4. Ensure code is formatted: `npm run format`
5. Push your branch and create a Pull Request to `develop`
6. Fill in the PR template with relevant information
7. Wait for review and address any feedback

## Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` to check for linting errors
- Run `npm run format` to auto-format code

## Testing

- Write tests for all new features and bug fixes
- Tests are located in `packages/reformer/tests/`
- Run tests with `npm run test -w reformer`
- Run tests in watch mode with `npm run test:watch -w reformer`

## Documentation

- Update documentation for any API changes
- Documentation is located in `projects/reformer-doc/`
- Build docs locally: `cd projects/reformer-doc && npm run start`

## Questions?

Feel free to open an issue if you have any questions or need help getting started.

## License

By contributing to Reformer, you agree that your contributions will be licensed under the MIT License.
