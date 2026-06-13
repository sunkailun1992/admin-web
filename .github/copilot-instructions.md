# GitHub Copilot Instructions

This repository is the `admin-web` Umi Max / React / TypeScript admin frontend. Before suggesting or changing code, read `AGENTS.md` and `docs/ai-coding/README.md`.

Follow these project rules:

- Follow `docs/ai-coding/AI_DIRECTORY_STRUCTURE_GUIDE.md` before adding, moving, or deleting directories.
- Pages belong under `src/pages`, API clients under `src/services`, reusable components under `src/components`, constants under `src/constants`.
- Do not commit generated or dependency directories such as `node_modules`, `dist`, `src/.umi`, `src/.umi-production`, or `.turbopack`.
- Do not replace backend authorization, tenant isolation, field-level authorization, or data permission checks with frontend-only logic.
- Do not change existing API addresses, tokens, secrets, or production configuration values. Report file paths and line numbers only.
