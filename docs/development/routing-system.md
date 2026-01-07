# Routing System

Vekku-Bun uses a domain-driven, encapsulated routing system built on top of **Hono**.

## Architecture

Routes are designed to be private to their respective domains. We follow a strict pattern to ensure separation of concerns and to prevent circular dependencies between services and routers.

### 1. Structure
Each domain (e.g., `user`, `tag`) contains its routing logic within an `_internal` directory:

```text
src/be/domain/
├── api.ts              # Abstract interface
├── index.ts            # Public entry point (Service + Router instance)
└── _internal/
    ├── ServiceImpl.ts  # Logic implementation
    └── routes.ts       # Hono route definitions
```

### 2. The Factory Pattern
To avoid circular dependencies (where the Router needs the Service, and the Service is exported by the index which also exports the Router), we use a **factory function** in `_internal/routes.ts`.

```typescript
// src/be/domain/_internal/routes.ts
export const createDomainRouter = (service: IDomainService) => {
  const router = new Hono();

  router.post("/", async (c) => {
    const data = await c.req.json();
    const result = await service.doSomething(data);
    return c.json(result);
  });

  return router;
};
```

### 3. Registration
The router is instantiated in the domain's `index.ts` by passing the singleton service instance into the factory:

```typescript
// src/be/domain/index.ts
import { DomainServiceImpl } from "./_internal/ServiceImpl";
import { createDomainRouter } from "./_internal/routes";

export const domainService = new DomainServiceImpl();
export const domainRouter = createDomainRouter(domainService);
```

### 4. Global Mounting
Finally, all domain routers are mounted in the main application entry point under the `/api` prefix:

```typescript
// src/index.ts
import { domainRouter } from "./be/domain";

app.route("/api/domain", domainRouter);
```

## Benefits
- **Opaque Internals:** External modules don't need to know how routes are implemented; they only see the `domainRouter` exported from `index.ts`.
- **Type Safety:** Routes are tightly coupled to the Service interface, ensuring consistent data handling.
- **Easy Testing:** Routers can be tested in isolation by passing a mock service to the factory function.
- **Organization:** Prevents the main `src/index.ts` from becoming a "mega-file" with hundreds of route definitions.
