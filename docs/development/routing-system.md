# Routing System

Vekku-Bun uses a domain-driven routing system integrated with **Hono Context** for lightweight dependency injection.

## Architecture

Routes are defined within each domain and access services through the Hono Context. This keeps the routing logic decoupled from the concrete service implementations.

### 1. Structure
Each domain (e.g., `user`, `tag`) contains its routing definitions and its service implementation:

```text
src/be/domain/
├── IAuthService.ts     # Interface (Contract)
├── AuthService.ts      # Implementation
└── routes.ts           # Hono route definitions
```

### 2. Context-Based DI
Instead of constructors or factories, routes retrieve their dependencies from the Hono context using `c.get()`. The keys and types are defined in a central `src/context.ts`.

```typescript
// src/be/user/routes.ts
const userRouter = new Hono<{ Variables: Variables }>();

userRouter.post("/login", async (c) => {
  const authService = c.get("authService"); // Returns IAuthService
  const result = await authService.login(...);
  return c.json(result);
});
```

### 3. Centralized Wiring
The application entry point (`src/index.ts`) is responsible for instantiating the services once per request (or once per lifecycle) and injecting them into the context via middleware.

```typescript
// src/index.ts
app.use(async (c, next) => {
  const db = drizzle(env.DATABASE_URL);
  const authService = new AuthService(db, hasher);
  
  c.set("authService", authService);
  await next();
});
```

## Benefits
- **Decoupling:** Routes only depend on interfaces (`IAuthService`), not concrete classes.
- **Zero Magic:** No DI libraries or complex reflection; just standard Hono features.
- **Platform Flexibility:** Different implementations can be injected based on environment variables (e.g., `BunHasher` vs `WebHasher`) in the central wiring.
- **Simplicity:** Extremely easy to follow the flow of data and dependencies.