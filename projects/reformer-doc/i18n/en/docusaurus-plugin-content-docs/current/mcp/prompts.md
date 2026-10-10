---
sidebar_position: 4
---

# Prompts

A prompt is a ready-made workflow scenario: the MCP client shows it to the user (in Claude Code — as
a slash command), and the server inserts instructions and the relevant documentation sections into
the conversation. Each prompt loads only the relevant sections, so it does not pull in the entire
documentation.

| Prompt             | Arguments                                | What it does                                                                                              |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `start-here`       | —                                        | The canonical workflow of the unified form contract and a map: which prompt, tool, resource at which step |
| `discover-context` | `description`, `projectPath?`            | Determine the project's target stack: `core` / `renderer-react` / `renderer-json`                         |
| `plan-form`        | `specPath`, `target?`, `projectPath?`    | Read a form spec (markdown) and return a development plan                                                 |
| `create-form`      | `description`, `target?`, `projectPath?` | Create a form from a description                                                                          |
| `add-feature`      | `feature`, `code`, `requirements`        | Add one capability to an existing form: `validation` / `behavior` / `array` / `wizard`                    |
| `to-renderer`      | `code`, `target?`                        | Switch the rendering approach: `renderer-react` (default) or `renderer-json` (format 2 document)          |
| `review`           | `code`                                   | A cross-package code review checklist                                                                     |
| `debug`            | `code`                                   | Only with `REFORMER_DEBUG=true` — analysis of a problematic form using the core troubleshooting guide     |

All prompts produce the same result for any rendering approach: a model, one schema, one
`createForm` bundle (rules — `validation` and the `flow` of steps, behavior — `behavior`); the only
difference is who renders the form.

## If prompts are unavailable

Not every MCP client supports prompts. The same content is available through tools and resources:
`get_context` assembles the context for a step, `plan_form` → `generate_form` build a form from a
spec, and the `reformer://guide` resource describes the whole workflow. Simply ask the AI:

```
Create a registration form with email, password and password confirmation
```

```
How do I add validation for the phone field?
```

```
Why is my form recreated on every render?
```

The AI will get up-to-date documentation through the MCP server and help with the task.
