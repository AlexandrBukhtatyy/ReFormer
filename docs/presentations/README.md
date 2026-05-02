# ReFormer Presentations

This folder contains presentation materials for the ReFormer library architecture.

## Available Presentations

| File                                 | Audience                      | Format           | Duration       |
| ------------------------------------ | ----------------------------- | ---------------- | -------------- |
| [01-technical.md](01-technical.md)   | Senior Developers, Architects | Marp slides      | 30-45 min      |
| [02-overview.md](02-overview.md)     | Tech Leads, Product Managers  | Marp slides      | 15-20 min      |
| [03-quickstart.md](03-quickstart.md) | New Users                     | Markdown guide   | 10-15 min read |
| [04-diagrams.md](04-diagrams.md)     | Architects, Tech Writers      | Mermaid diagrams | Reference      |

## Rendering Slides

Presentations use [Marp](https://marp.app/) format for slides.

### VS Code

Install the Marp extension and open `.md` files to preview slides.

### CLI

```bash
npm install -g @marp-team/marp-cli

# Generate HTML
marp 01-technical.md -o 01-technical.html

# Generate PDF
marp 01-technical.md -o 01-technical.pdf

# Generate PPTX
marp 01-technical.md -o 01-technical.pptx
```

## Rendering Diagrams

Diagrams in [04-diagrams.md](04-diagrams.md) use Mermaid syntax.

### Options

- **Mermaid Live Editor**: https://mermaid.live
- **GitHub/GitLab**: Native rendering in markdown
- **VS Code**: Mermaid Preview extension
- **Export**: SVG/PNG from Mermaid Live Editor

## Customization

To customize slide themes, edit the YAML frontmatter:

```yaml
---
marp: true
theme: gaia # default, gaia, uncover
paginate: true
backgroundColor: #fff
---
```
