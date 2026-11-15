---
sidebar_position: 4
---

# Prompts

A prompt is a ready-made workflow scenario: the MCP client shows it to the user (in Claude Code — as
a slash command), and the server inserts instructions and the relevant documentation sections into
the conversation. Each prompt loads only the relevant sections, so it does not pull in the entire
documentation.

Prompts exist only in the tool set (`REFORMER_SURFACE=tools`): every one of them leads through
`form_build`. In the default surface (`code-guided-dsl`) the server's plan leads the work, and it has
no prompts — see [surfaces](./overview#surfaces).

| Prompt             | Arguments                                | What it does                                                                                              |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `start-here`       | —                                        | The canonical workflow of the unified form contract and a map: which prompt, tool, resource at which step |
| `discover-context` | `description`, `projectPath?`            | Determine the project's target stack: `core` / `renderer-react` / `renderer-json`                         |
| `plan-form`        | `specPath`, `target?`, `projectPath?`    | Parse a form spec (markdown): a `plan_form` draft, finishing the intent, `form_build`                     |
| `create-form`      | `description`, `target?`, `projectPath?` | Create a form from a description                                                                          |
| `add-feature`      | `feature`, `requirements`, `code?`       | Add one capability to an existing form: `validation` / `behavior` / `array` / `wizard`                    |
| `to-renderer`      | `code?`, `target?`                       | Switch the rendering approach: `renderer-react` (default) or `renderer-json` (format 2 document)          |
| `review`           | `code`                                   | A cross-package code review checklist                                                                     |
| `debug`            | `code`                                   | Only with `REFORMER_DEBUG=true` — analysis of a problematic form using the core troubleshooting guide     |

All prompts produce the same result for any rendering approach: a model, one schema, one
`createForm` bundle (rules — `validation` and the `flow` of steps, behavior — `behavior`); the only
difference is who renders the form.

## If prompts are unavailable

Not every MCP client supports prompts. The same content is available through tools and resources:
`get_context` assembles the context for a step, `plan_form` drafts the intent from a spec,
`form_build` builds the form module from the intent, and the `reformer://guide` resource describes the
whole path. The `code` argument of `add-feature` and `to-renderer` is the current `form.intent.json`;
without it the agent reads the file from the form folder. Simply ask the AI:

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
