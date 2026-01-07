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
Update `.env` with your `DATABASE_URL` and a secure `JWT_SECRET`.

## 3. Database Setup
Push the schema to your database using Drizzle Kit:
```bash
bun x drizzle-kit push
```

## 4. Build the Frontend
Bundle the React application:
```bash
bun run build:fe
```

## 5. Running the Application
### Development (FE + BE)
To run both the backend server and the frontend watcher concurrently:
```bash
bun run dev:all
```
This will:
- Watch for changes in `src/fe` and rebuild automatically.
- Start the Hono server with hot-reload.
- Serve the application at `http://localhost:3000`.

### Backend Only
```bash
bun run dev
```

## 6. Testing
Run the test suite using Bun's native test runner:
```bash
# Run all tests
bun test

# Run specific domain tests
bun test src/be/user
```

## Development Workflow
- **Backend:** Changes in `src/be` or `src/index.ts` will trigger a server reload.
- **Frontend:** To auto-rebuild the frontend on changes, run:
  ```bash
  bun build --watch ./src/fe/index.html --outdir ./dist
  ```
