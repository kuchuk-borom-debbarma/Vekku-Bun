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
- `BETTER_AUTH_SECRET`: A secure random string (generate one with `openssl rand -base64 32`).
- `BETTER_AUTH_URL`: Your base URL (e.g., `http://localhost:3000`).

## 3. Database Management
We use Drizzle ORM for database interactions.

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

### Testing Auth (Magic Link)
Since we don't have an email provider configured for development, Magic Links are logged to the console.
1. Send a POST request to request a login:
   ```bash
   curl -X POST http://localhost:3000/api/auth/sign-in/magic-link \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```
2. Check your terminal console for the Magic Link URL.
3. Open the link to verify the session.

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
bun x wrangler secret put BETTER_AUTH_SECRET
bun x wrangler secret put BETTER_AUTH_URL
```

### 3. Deploy
```bash
bun x wrangler deploy
```

## 6. Testing
Run the test suite using Bun's native test runner:
```bash
# Run all tests
bun test

# Run specific module tests
bun test src/modules/tags
```

## Development Workflow
- **Backend:** Changes in `src/modules` or `src/index.ts` will trigger a server reload.
