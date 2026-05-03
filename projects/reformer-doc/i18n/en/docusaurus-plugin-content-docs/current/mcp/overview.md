---
sidebar_position: 1
---

# Overview

**@reformer/mcp** is an MCP server (Model Context Protocol) that provides AI assistants with complete context about the ReFormer library to help with form development.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard by Anthropic for integrating AI assistants with external tools and data. MCP servers provide:

- **Tools** — functions that AI can call
- **Prompts** — pre-built templates for common tasks
- **Resources** — access to documentation and data

## @reformer/mcp Capabilities

### Code Generation

- Create forms from text descriptions
- Generate TypeScript types
- Create validation schemas
- Set up behaviors (computed fields, conditional fields)

### Quality Checking

- Analyze code for common errors
- Check import correctness
- Recommend project structure

### Development Assistance

- Explain errors with fix examples
- Show usage patterns
- Provide up-to-date API documentation

## Supported IDEs

| IDE             | Status          |
| --------------- | --------------- |
| Claude Code     | ✅ Full support |
| Cursor          | ✅ Full support |
| Windsurf        | ✅ Full support |
| Cline (VS Code) | ✅ Full support |

## Next Step

Go to [Quick Start](./quick-start) to install and configure the MCP server.
