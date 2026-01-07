# Routing System

Vekku-Bun uses a domain-driven, encapsulated routing system built on top of **Hono**.

## Architecture

Routes are managed by **Controllers** within each domain. These controllers are registered in the Dependency Injection container, allowing them to accept injected services.

### 1. Structure
Each domain (e.g., `user`, `tag`) contains its routing logic within a Controller class in `_internal`:

```text
src/be/domain/
├── api.ts              # Abstract interface
├── index.ts            # Public entry point (Service + Controller Registration)
└── _internal/
    ├── ServiceImpl.ts  # Logic implementation
    └── UserController.ts # Route definitions (Controller)
```

### 2. The Controller Pattern
The Controller class accepts the Service via constructor injection and exposes a `routes()` method that returns a configured Hono router.

```typescript
// src/be/user/_internal/UserController.ts
export class UserController {
  constructor({ authService }: Deps) {
    this.authService = authService;
  }

  routes(): Hono {
    const router = new Hono();
    router.post("/login", ...);
    return router;
  }
}
```

### 3. Public Entry Point (index.ts)
The domain's `index.ts` registers both the Service and the Controller into the Awilix container.

```typescript
// src/be/user/index.ts
import { UserController } from "./_internal/UserController";

export const registerUserDomain = (container: AwilixContainer) => {
  container.register({
    authService: asClass(AuthServiceImpl).singleton(),
    userController: asClass(UserController).singleton(),
  });
};
```

### 4. Global Mounting
The main application simply resolves the controllers and mounts their routes.

```typescript
// src/index.ts
const userController = container.resolve<UserController>("userController");
app.route("/api/user", userController.routes());
```

## Benefits
- **Full Dependency Injection:** Controllers are fully managed by the container.
- **Encapsulation:** Route logic is hidden within the Controller class.
- **Standardization:** Follows a familiar MVC-like structure (Service -> Controller -> Router).
- **Testability:** Controllers can be unit tested by injecting mock services.
