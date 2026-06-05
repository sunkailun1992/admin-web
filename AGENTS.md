# AGENTS.md

This file is the AI entrypoint for `admin-web`.

## Project Identity

- Project: `admin-web`
- Kind: user-center admin frontend
- Stack: Ant Design Pro, Umi Max, React, TypeScript, Ant Design 5, ProComponents
- Package manager: `pnpm`
- Gateway repo: `/Users/sunkailun/Desktop/个人/GitHub/gateway`
- Backend repo: `/Users/sunkailun/Desktop/个人/GitHub/user`
- Gateway dev URL: `http://localhost:8080`
- User service direct URL: `http://localhost:7500`
- Request mode: direct `request.baseURL`, not Umi dev proxy

## What This App Does

This app manages the `user` backend authentication domain:

- Login
- Tenant management
- User management
- Role management
- Permission resource management
- User-role binding
- Role-resource binding

## First Files To Read

Read these before changing behavior:

1. `README.md`
2. `docs/AI_CODING_GUIDE.md`
3. `.umirc.ts`
4. `src/app.ts`
5. `src/access.ts`
6. `src/services/auth/index.ts`
7. `src/services/auth/types.d.ts`

When API behavior is unclear, read the backend repo:

```text
/Users/sunkailun/Desktop/个人/GitHub/user
```

Relevant backend files:

```text
README.md
src/main/java/com/kellen/auth/controller
src/main/java/com/kellen/auth/entity/bo
src/main/java/com/kellen/auth/entity/query
src/main/java/com/kellen/auth/entity/vo
src/main/resources/db/auth-schema.sql
```

## Multi-Agent Rules

- Multiple sub-agents may be used, but by default they only perform requirement analysis and project learning; they must not edit code directly.
- For project learning, split explorers by frontend pages, backend APIs, permission resources, gateway/Nacos config, and build scripts.
- For issue triage, split explorers by frontend requests, backend controllers, config/permissions, database/logs, and recent changes; the main agent must decide the root cause.
- For code review, split reviewers by security risk, logic bugs, missing tests, performance, and maintainability; the main agent owns the final review summary.
- For test regression, one agent may run tests, one may inspect logs, and one may inspect recent diffs; the main agent or one explicit worker owns the fix.
- Parallel implementation is allowed only when write boundaries are clear, such as one worker only changing frontend pages, one only changing backend APIs, and one only adding tests.
- If multiple workers need to edit the same core page, service file, route file, permission logic, SQL script, or shared config, do not parallelize writes; the main agent must serialize the work.

## API Contract

- Login: `POST /auth/sessions`
- Public tenant list: `GET /auth/tenants`
- Current resources: `GET /auth/current/resources`
- Current tenants: `GET /auth/current/tenants`
- Tenants: `GET /auth/manage/tenants`, `GET /auth/manage/tenants/options`, `POST /auth/manage/tenants`, `PUT|DELETE /auth/manage/tenants/{id}`
- Users: `GET /auth/manage/users`, `GET /auth/manage/users/options`, `POST /auth/manage/users`, `PUT|DELETE /auth/manage/users/{id}`
- Depts: `GET /auth/manage/depts`, `GET /auth/manage/depts/options`, `POST /auth/manage/depts`, `PUT|DELETE /auth/manage/depts/{id}`
- Roles: `GET /auth/manage/roles`, `GET /auth/manage/roles/options`, `POST /auth/manage/roles`, `PUT|DELETE /auth/manage/roles/{id}`
- Resources: `GET /auth/manage/resources`, `GET /auth/manage/resources/options`, `POST /auth/manage/resources`, `PUT|DELETE /auth/manage/resources/{id}`
- User roles: `GET|POST|PUT /auth/manage/users/{userId}/roles`
- Role resources: `GET|POST|PUT /auth/manage/roles/{roleId}/resources`
- Role data scope depts: `GET|PUT /auth/manage/roles/{roleId}/data-scope-depts`
- Generate code: `POST /auth/manage/codes`

The frontend uses Umi request `baseURL = http://localhost:8080`; user-center API calls are prefixed inside `src/services/auth/index.ts`, so `/auth/sessions` produces gateway requests like `/user/auth/sessions`. The gateway rewrites `/user/**` to the `user` service.

All authenticated requests use:

```text
Authorization: Bearer <token>
```

## Permission Contract

Backend permission required for management pages:

```text
user:auth:manage
```

Frontend resource codes:

```text
menu:tenant
menu:user
menu:role
menu:resource
```

Permission checks live in `src/access.ts`.

## Coding Constraints

- Keep service calls in `src/services/auth/index.ts`.
- Keep API types in `src/services/auth/types.d.ts`.
- Use ProComponents for management UI.
- Do not invent backend fields. Match backend `BO`, `Query`, and `VO`.
- Use tenant names for display. Keep `tenantId` internal for API calls.
- Use the backend code generator for code fields. Do not generate business codes in the browser.
- Preserve optimistic locking by sending `version` on update.
- Run `pnpm build` after functional changes.

## Do Not Commit

```text
node_modules/
dist/
.turbopack/
src/.umi/
src/.umi-production/
.idea/
*.iml
.DS_Store
*.log
```
