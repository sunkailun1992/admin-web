# GitHub Copilot Instructions

This repository is the `admin-web` admin frontend: a pnpm workspace + Turborepo monorepo with Vite, React 19, TypeScript, Module Federation 2 micro-frontends (host `apps/shell`, remotes `apps/system`, `apps/message`, `apps/ai`, `apps/rag`), and a shadcn/ui + Tailwind CSS 4 component package (`packages/ui`). Before suggesting or changing code, read `AGENTS.md` and `docs/ai-coding/README.md`.

Follow these project rules:

- Follow `docs/ai-coding/AI_DIRECTORY_STRUCTURE_GUIDE.md` before adding, moving, or deleting directories.
- Pages belong under `apps/<app>/src/pages`, API clients under `apps/<app>/src/services` (sent through that app's `src/http.ts` client), and a remote's routes and menu under `apps/<app>/src/routes.tsx`. Components reused across apps belong in `packages/ui` with Storybook stories and tests.
- Apps must not import each other's source; they talk only through Module Federation exposes and shared packages, and shared packages are imported from their entry points (enforced by ESLint).
- UI text goes through i18n keys (`packages/i18n`); do not hard-code CJK text in app source. Backend messages are shown as returned.
- Do not commit generated or dependency directories such as `node_modules`, `dist`, `.turbo`, `storybook-static`, `e2e-out`, `.vitest`, or `packages/ui/public/r`.
- Do not replace backend authorization, tenant isolation, field-level authorization, or data permission checks with frontend-only logic. The session lives in the gateway; the frontend never stores or sends access tokens.
- Do not change existing API addresses, tokens, secrets, or production configuration values. Report file paths and line numbers only.
