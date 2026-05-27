# AGENTS.md

This file is the AI entrypoint for `admin-web`.

## Project Identity

- Project: `admin-web`
- Kind: user-center admin frontend
- Stack: Ant Design Pro, Umi Max, React, TypeScript, Ant Design 5, ProComponents
- Package manager: `pnpm`
- Backend repo: `/Users/sunkailun/Desktop/个人/GitHub/user`
- Backend dev URL: `http://localhost:7500`

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

## API Contract

- Login: `POST /auth/login`
- Current resources: `GET /auth/resources`
- Tenants: `/auth/manage/tenants`
- Users: `/auth/manage/users`
- Roles: `/auth/manage/roles`
- Resources: `/auth/manage/resources`
- Bind user role: `POST /auth/manage/user-roles`
- Bind role resource: `POST /auth/manage/role-resources`

The frontend proxies `/auth` to `http://localhost:7500`.

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
