# Agent instructions (Cursor, Claude, others)

This repo is edited by **multiple AI tools**. The following stay in sync as the **shared source of truth** for how to work here:

| Location | Role |
|----------|------|
| **`.cursor/rules/*.mdc`** | Project rules with YAML frontmatter. **Cursor** loads these automatically. **Claude Code** and other agents should follow them when changing code—they are not Cursor-only. |
| **`CLAUDE.md`** | Architecture, commands, env vars, and **product / UX design** context. Optimized for Claude Code; humans and other agents should read it for brand and UX. |
| **`AGENTS.md`** | This file: where to look so nothing important lives in only one place. |

**If something conflicts:** prefer `.cursor/rules` for stack/auth/code patterns, and `CLAUDE.md` for product voice and visual design unless a rule explicitly overrides.

**Do not commit** local-only paths such as `.claude/` (see `.gitignore`).
