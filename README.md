<div align="center">
  <h1>Orbitron</h1>
  <p><strong>A powerful, extensible workflow automation platform built with modern web technologies.</strong></p>
  
  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
    <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
    <img alt="Prisma" src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" />
  </p>
</div>

---

Orbitron allows users to visually design workflows using a node-based editor and execute them reliably in the background, integrating seamlessly with top AI models and external services.

## Technical Overview

Orbitron is built as a monorepo-style Next.js application, leveraging a robust and bleeding-edge stack for high performance, end-to-end type safety, and exceptional developer experience.

### Technology Stack & Key Libraries

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) with `tw-animate-css` for seamless animations
- **UI Components:** [Radix UI](https://www.radix-ui.com/) primitives and [Shadcn/ui](https://ui.shadcn.com/) for beautiful, accessible components
- **Visual Editor:** [React Flow (xyflow)](https://reactflow.dev/) for an interactive, drag-and-drop node-based canvas
- **Workflow Engine:** [Inngest](https://www.inngest.com/) for durable, serverless-ready background execution
- **API Layer:** [tRPC](https://trpc.io/) for fully type-safe APIs between client and server
- **Database & ORM:** [Prisma](https://www.prisma.io/) over a PostgreSQL database
- **Authentication:** [Better Auth](https://www.better-auth.com/) for secure, customizable identity management
- **State Management & Data Fetching:** [Jotai](https://jotai.org/) for atomic global state and [React Query](https://tanstack.com/query/latest) (integrated via tRPC) for caching and data synchronization
- **AI Integration:** Official AI SDKs (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) built directly into the engine
- **Monitoring & Error Tracking:** [Sentry](https://sentry.io/) (`@sentry/nextjs`)
- **Form Validation:** [React Hook Form](https://react-hook-form.com/) and [Zod](https://zod.dev/)

---

## Architecture

The application is structured into domain-specific feature modules to maintain maintainability, modularity, and separation of concerns.

### Directory Structure

```text
Orbitron/
├── src/
│   ├── app/           # Next.js App Router pages, layouts, and API routes
│   ├── components/    # Shared UI components (Radix UI, Shadcn/ui)
│   ├── config/        # Global configuration, constants, and environment variables
│   ├── features/      # Core business logic, split by domain:
│   │   ├── auth/      # Authentication logic, components, and hooks
│   │   ├── editor/    # The visual workflow builder and React Flow integration
│   │   ├── executions/# Logic for monitoring and running instances of workflows
│   │   ├── triggers/  # Event listeners and webhooks that start workflows
│   │   └── workflows/ # CRUD operations and definitions for workflow entities
│   ├── hooks/         # Shared React hooks
│   ├── inngest/       # Inngest functions, clients, and event definitions
│   ├── lib/           # Utility functions, type definitions, and shared helpers
│   └── trpc/          # Backend logic including tRPC routers and context setup
├── prisma/            # Database schema and migrations
└── package.json       # Project dependencies and scripts
```

### Data Model (Prisma)

The core data entities are meticulously modeled in `prisma/schema.prisma` for PostgreSQL:

- **User, Session, Account, Credential:** Manages identities, OAuth accounts, and securely stores third-party API keys (e.g., OpenAI, Anthropic, Gemini credentials).
- **Workflow:** The parent entity containing the structure of an automated process.
- **Node:** Individual logical steps in a workflow. Supported node types include `INITIAL`, `MANUAL_TRIGGER`, `HTTP_REQUEST`, `GOOGLE_FORM_TRIGGER`, `STRIPE_TRIGGER`, `OPENAI`, `ANTHROPIC`, and `GEMINI`. Nodes store positional data for the canvas and custom JSON data for configuration.
- **Connection:** Directed edges linking nodes (from output to input) to strictly define the execution flow.

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- **Node.js:** v20 or newer
- **pnpm:** Preferred package manager
- **PostgreSQL:** A running database instance (local or hosted)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd Orbitron
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   Copy the example environment file and fill in the necessary secrets:
   ```bash
   cp .env.example .env
   ```
   **Required variables:**
   - `DATABASE_URL`: Connection string for PostgreSQL
   - `BETTER_AUTH_SECRET`: Secret for Better Auth session signing
   - Additional third-party API keys as needed (e.g., OpenAI, Stripe)

4. **Database Setup:**
   Synchronize your Prisma schema with the database:
   ```bash
   pnpm prisma db push
   ```

### Development

Run the development server with Turbopack for lightning-fast HMR:

```bash
pnpm dev
```

**Running Inngest (Required for Workflow Execution)**

Workflows rely on the Inngest execution engine. You can run Inngest alongside your dev server using:

```bash
pnpm inngest
```

> **Tip:** You can use the convenient concurrent script to run Next.js and any other required processes simultaneously:
> ```bash
> pnpm devt
> ```

---

## Key Features

- **Visual Workflow Builder:** An intuitive, drag-and-drop interface powered by React Flow for creating complex logic flows without writing code.
- **AI First:** Native integrations for calling large language models (OpenAI, Anthropic, Gemini) as individual steps in your workflow.
- **Serverless-Ready Execution:** Built on Inngest for reliable, durable background jobs, retries, and sleep functionality.
- **Type-Safe APIs:** Full end-to-end type safety from the database to the frontend components using Prisma, tRPC, and Zod.
- **Secure by Default:** Robust authentication via Better Auth and secure credential management for third-party integrations.
