# Custom Stateless Authentication

We use a custom, lightweight authentication system designed for simplicity and stateless verification.

## Architecture

### 1. Stateless Signup
Instead of storing "pending" users in the database, we encode the user's registration details into a signed JWT.

1.  **Request:** User submits `email`, `password`, `name`.
2.  **Token:** Server hashes password and signs `{ email, passwordHash, name }` into a JWT.
3.  **Email:** Server sends a link containing this token.
4.  **Verify:** When clicked, server verifies signature and **Inserts** the user into the DB.

### 2. Login
Standard Email/Password login.
1.  **Request:** `email`, `password`.
2.  **Verify:** Server checks DB and verifies password hash.
3.  **Session:** Returns `accessToken` (JWT) and `refreshToken`.

## API Endpoints

### `POST /api/auth/signup/request`
*   **Body:** `{ "email": "...", "password": "...", "name": "..." }`
*   **Response:** `{ "message": "..." }` (Logs URL to console in Dev)

### `GET /api/auth/signup/verify?token=...`
*   **Action:** Creates the user.
*   **Response:** `{ "user": { ... } }`

### `POST /api/auth/login`
*   **Body:** `{ "email": "...", "password": "..." }`
*   **Response:** `{ "accessToken": "...", "refreshToken": "..." }`

## Database Schema
The `user` table is minimal:
*   `id`: UUID
*   `username`: Email (Unique)
*   `password`: Hashed Password
*   `name`: User's Name
*   `role`: "user" (default)

## Testing
You can easily test this flow using the **Web UI Tester**:
1. Run `bun run test:ui`.
2. Use the **Authentication** sidebar to Request Signup, Verify (paste the token logged in the backend console), and Login.
