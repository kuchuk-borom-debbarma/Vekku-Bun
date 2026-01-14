# Project Setup Guide

Follow these steps to get **Vekku-Bun** running on your local machine.

## Prerequisites
- [Bun](https://bun.sh/) installed (latest version recommended)
- A PostgreSQL database (e.g., [Neon.tech](https://neon.tech))

## 1. Installation
Install dependencies using Bun:
```bash
bun install
```

## 2. Environment Configuration
Copy the example environment file and fill in your details:
```bash
cp .env.example .env
```
Update `.env` with:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `JWT_SECRET`: Used as the JWT signing key (keep it secure).

## 3. Database Management
We use Drizzle ORM for database interactions.

### One-Time Setup (Extensions)
This project uses `pgvector` for embeddings and `pg_search` for advanced full-text search. Enable them in your PostgreSQL instance:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_search;
```

### Sync Schema (Development)
Quickly push schema changes to the database (prototyping/dev):
```bash
bun run db:push
```

### Migrations (Production)
Generate SQL migration files based on schema changes:
```bash
bun run db:generate
```
*Note: You will need to run these migrations against your production DB using a migration runner.*

### Visual Editor
Open Drizzle Studio to browse and edit your data:
```bash
bun run db:studio
```

## 4. Running the Application
### Development
To start the Hono server with hot-reload:
```bash
bun run dev
```
The API will be available at `http://localhost:3000`.

### Testing Auth (Custom Stateless)
1. **Request Signup:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup/request \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123", "name": "Test User"}'
   ```
2. **Verify:** Check your terminal for the `Verify Signup` URL and open it (or curl it).
   ```bash
   curl "http://localhost:3000/api/auth/signup/verify?token=YOUR_TOKEN"
   ```
3. **Login:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}'
   ```

## 5. Deployment (Cloudflare Workers)
This project is configured for Cloudflare Workers.

### 1. Setup
Install Wrangler:
```bash
bun add -d wrangler
```

### 2. Configure Secrets
Set your secrets:
```bash
bun x wrangler secret put DATABASE_URL
bun x wrangler secret put JWT_SECRET
```

### 3. Deploy
```bash
bun x wrangler deploy
```

## 6. Testing
### Unit Tests
Run the test suite using Bun's native test runner:
```bash
# Run all tests
bun test

# Run specific module tests
bun test src/modules/tags
```

### Web UI Tester
We provide a local dashboard to test the API flows (Auth, Tags, Content) visually.

1.  Start the backend:
    ```bash
    bun run dev
    ```
2.  Start the UI tester (in a new terminal):
    ```bash
    bun run test:ui
    ```
3.  Open `http://localhost:8080` to interact with your local API.

## Development Workflow
- **Backend:** Changes in `src/modules` or `src/index.ts` will trigger a server reload.
