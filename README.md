# Orbitron

Orbitron is a powerful, extensible workflow automation platform built with modern web technologies. It allows users to visually design workflows using a node-based editor and execute them reliably in the background.

## 🚀 Technical Overview

This project is built as a monorepo-style Next.js application, leveraging a robust stack for high performance and type safety.

### Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database ORM**: [Prisma](https://www.prisma.io/) (PostgreSQL)
- **API Layer**: [tRPC](https://trpc.io/) (Type-safe APIs)
- **Workflow Engine**: [Inngest](https://www.inngest.com/) (Durable execution)
- **Visual Editor**: [React Flow](https://reactflow.dev/) (Interactive node-based UI)
- **Authentication**: [Better Auth](https://www.better-auth.com/)
- **State Management**: [Jotai](https://jotai.org/) & [React Query](https://tanstack.com/query/latest)

## 🏗️ Architecture

The application is structured into domain-specific features to maintain modularity.

### Directory Structure

- `src/app`: Next.js App Router pages and layouts.
- `src/components`: Shared UI components (Radix UI, Shadcn/ui).
- `src/features`: core business logic, split by domain:
  - `auth`: Authentication logic.
  - `editor`: The visual workflow builder.
  - `executions`: Logic for running instances of workflows.
  - `triggers`: Event listeners that start workflows.
  - `workflows`: CRUD operations and definitions for workflow entities.
- `src/server`: Backend logic including tRPC routers.
- `prisma`: Database schema and migrations.

### Data Model

The core data entities are defined in `prisma/schema.prisma`:

- **Workflow**: The parent entity containing the graph structure.
- **Node**: Individual steps in a workflow (e.g., `MANUAL_TRIGGER`, `HTTP_REQUEST`).
- **Connection**: Directed edges linking nodes to define execution flow.
- **Execution** (implied): Instances of running workflows managed via Inngest.

## 🛠️ Getting Started

### Prerequisites

- Node.js (v20+)
- pnpm (Preferred package manager)
- PostgreSQL database

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
   Copy `.env.example` to `.env` and fill in necessary secrets (Database URL, Auth secrets).

4. **Database Setup:**
   ```bash
   pnpm prisma db push
   ```

### Development

Run the development server with Turbopack:

```bash
pnpm dev
# or for concurrent dev + inngest
pnpm run devt
```

Start the Inngest local dev server (required for workflow execution):

```bash
pnpm inngest
```

## 📜 Key Features

- **Visual Workflow Builder**: Drag-and-drop interface creating complex logic flows.
- **Serverless-Ready Execution**: Built on Inngest for reliable, durable background jobs.
- **Type-Safe APIs**: Full end-to-end type safety with tRPC.
- **Secure**: Authentication and authorization baked in.
