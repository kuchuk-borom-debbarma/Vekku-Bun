# Vekku

> **Intelligent, AI-Powered Content Backend for Knowledge Management**

Vekku is a high-performance backend service designed for building "Second Brain", bookmarking, or content curation applications. It solves the chaos of unorganized content by using local and cloud-native AI to automatically suggest tags, organize data semantically, and learn from user preferences over time.

Built with performance and portability in mind, Vekku runs seamlessly on the **Bun** runtime or at the edge on **Cloudflare Workers**.

---

## 🚀 Key Features

### 🧠 AI-Powered Organization
*   **Semantic Tagging:** Uses vector embeddings (`pgvector`) to understand the *meaning* of your content and suggest relevant tags you've already created, even if keywords don't match exactly.
*   **Smart Keyword Extraction:** Analyzes content text to propose *new* high-value tags using KeyBERT-inspired algorithms.
*   **Adaptive Learning:** The system learns from your feedback. Accept or reject suggestions to refine the "Cluster Suggestion Strategy" for your specific mental model.

### ⚡ High Performance Architecture
*   **Cache-First Suggestions:** AI operations are expensive. Vekku uses a smart Redis caching layer to deliver instant suggestions and bypass rate limits for repeated queries.
*   **Cursor-Anchored Pagination:** A specialized pagination strategy designed to handle deep offsets in large datasets without the performance penalty of standard SQL `OFFSET`.
*   **Optimized Stats:** Dashboard counters (total tags, content) use O(1) metadata lookups, avoiding slow table scans.

### 🛠 Modern & Flexible
*   **Platform Agnostic:** Write once, run anywhere. The core logic is decoupled from the runtime, allowing deployment on a local Bun server or globally distributed Cloudflare Workers.
*   **Event-Driven:** Heavy background tasks (like generating embeddings or calculating stats) are handled via an internal Event Bus, keeping the API response times fast.

---

## 🏗 Tech Stack

*   **Runtime:** [Bun](https://bun.sh) (Local) / Cloudflare Workers (Edge)
*   **Language:** TypeScript
*   **Framework:** Hono (Lightweight, Web Standards based)
*   **Database:** PostgreSQL (via Neon Serverless)
*   **ORM:** Drizzle ORM
*   **Vector Search:** `pgvector`
*   **Caching:** Redis (Upstash)

---

## 🏁 Getting Started

### Prerequisites
1.  **Bun** (v1.0+) installed.
2.  **PostgreSQL** database (e.g., Neon) with `pgvector` extension enabled.
3.  **Redis** instance (e.g., Upstash) for caching.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/vekku-bun.git
    cd vekku-bun
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```

3.  **Configure Environment:**
    Copy the example env file and fill in your credentials.
    ```bash
    cp .env.example .env
    ```
    *Ensure you provide valid `DATABASE_URL`, `REDIS_URL`, and AI provider keys.*

4.  **Initialize Database:**
    Push the schema to your database.
    ```bash
    bun run db:push
    ```

5.  **Run Development Server:**
    ```bash
    bun run dev
    ```

---

## 📚 Documentation

Detailed documentation for contributors and integrators is available in the `docs/` directory:

*   **[API Architecture & Flow](docs/api-flow.md):** Visual diagrams of authentication, tagging, and content flows.
*   **[AI System Deep Dive](docs/development/ai-suggestions-system.md):** How the hybrid embedding/keyword extraction engine works.
*   **[Pagination Strategy](docs/development/cursor-anchored-pagination.md):** Understanding the custom pagination logic.
*   **[Platform Agnostic Setup](docs/development/platform-agnostic-setup.md):** How the codebase adapts to different runtimes.

---

## 🧪 Testing

Vekku includes a comprehensive test suite using `bun:test`.

*   **Run Unit Tests:** `bun test`
*   **Run Web UI Tester:** `bun run test:ui` (Starts a local dashboard to visually test Auth and API flows).