# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please send an email to the maintainers with:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** of the vulnerability
4. **Suggested fix** (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within 30 days
- **Credit**: We will credit reporters in our security advisories (unless you prefer to remain anonymous)

### Scope

This security policy applies to:

- The `reformer` npm package
- The official documentation site
- This GitHub repository

### Out of Scope

- Vulnerabilities in dependencies (please report these to the respective maintainers)
- Issues in user applications built with reformer
- Social engineering attacks

## Security Best Practices

When using reformer in your applications:

1. **Keep dependencies updated** - Regularly update to the latest version
2. **Validate user input** - Always validate form data on the server side
3. **Use HTTPS** - Ensure your application uses secure connections
4. **Sanitize output** - Properly escape user-provided data before rendering

## Security Updates

Security updates will be released as patch versions. We recommend:

- Enabling automatic security updates via Dependabot
- Subscribing to GitHub Security Advisories for this repository
- Following semantic versioning for safe updates

## Acknowledgments

We thank all security researchers who help keep reformer and its users safe.
