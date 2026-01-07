# Routing System

Vekku-Bun uses a domain-driven, encapsulated routing system built on top of **Hono**.

## Architecture

Routes are designed to be private to their respective domains. We follow a "Mounting Pattern" where the main application passes a Router instance to the domain, and the domain attaches its routes.

### 1. Structure
Each domain (e.g., `user`, `tag`) contains its routing logic within an `_internal` directory:

```text
src/be/domain/
├── api.ts              # Abstract interface
├── index.ts            # Public entry point (Service Registration + Route Mounting)
└── _internal/
    ├── ServiceImpl.ts  # Logic implementation
    └── routes.ts       # Hono route definitions
```

### 2. The Mounting Pattern
Instead of the domain creating its own Router instance, it exports a function that accepts a Router and the Service.

```typescript
// src/be/domain/_internal/routes.ts
export const registerDomainRoutes = (router: Hono, service: IDomainService) => {
  router.post("/", async (c) => {
    const data = await c.req.json();
    const result = await service.doSomething(data);
    return c.json(result);
  });
};
```

### 3. Public Entry Point (index.ts)
The domain's `index.ts` is responsible for resolving the service from the Dependency Injection container and calling the internal registration function.

```typescript
// src/be/domain/index.ts
import { registerDomainRoutes } from "./_internal/routes";

// 1. Register Services (for DI)
export const registerDomain = (container: AwilixContainer) => {
  container.register({
    domainService: asClass(DomainServiceImpl).singleton(),
  });
};

// 2. Mount Routes (for HTTP)
export const mountDomainRoutes = (router: Hono, container: AwilixContainer) => {
  const service = container.resolve<IDomainService>("domainService");
  registerDomainRoutes(router, service);
};
```

### 4. Global Mounting
The main application creates the router instances and hands them to the domains.

```typescript
// src/index.ts
import { mountDomainRoutes } from "./be/domain";

const app = new Hono();
const container = createAppContainer();

// Create sub-app
const domainApp = new Hono();
mountDomainRoutes(domainApp, container);

// Mount sub-app
app.route("/api/domain", domainApp);
```

## Benefits
- **Inversion of Control:** The main app controls the Router creation (middleware, settings).
- **Separation of Concerns:** The DI container manages *Services*, not *Routers*.
- **Opaque Internals:** Route implementation details remain hidden in `_internal`.
- **Testability:** Routes can be tested by passing a mock Hono instance and mock Service.