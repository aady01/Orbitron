# User Credentials Management Spec

## 1. Overview
The Credentials Management feature in Orbitron introduces a secure, centralized way for users to manage third-party API keys and credentials (such as OpenAI, Anthropic, and Gemini keys). 

Instead of relying on global environment variables, users can create, update, and manage their own credentials through the dashboard. These credentials can then be dynamically attached to specific workflow nodes (e.g., AI Nodes) directly from the node configuration dialog on the canvas.

## 2. Architecture & Data Flow
The integration relies on a full-stack tRPC architecture with server-side rendering support and client-side URL state management.

### Credentials Lifecycle
1. **Creation/Editing**: Users navigate to the `/credentials` route to view a paginated, searchable list of their stored API keys. From here, they can add a new credential or edit an existing one. The form validates the input using Zod and sends a mutation via tRPC to store the data in the PostgreSQL database via Prisma.
2. **Server-Side Hydration**: The credentials list and details pages utilize Next.js Server Components. Data is prefetched on the server using `prefetchCredentials` and hydrated into the client via `<HydrateClient>`. URL search params for pagination and search are managed using `nuqs`.
3. **Workflow Integration**: When a user configures a node that requires authentication (like the OpenAI node), the node dialog uses the `useCredentialsByType` hook to fetch and display only the relevant credentials. The selected `credentialId` is saved to the Node's data payload.
4. **Execution**: During a workflow execution run, the executor checks the node's `data.credentialId`. If missing, the execution fails with a descriptive error. (Note: The executor will retrieve the credential value from the database to instantiate the API client).

## 3. Components Involved

### 3.1 Schema & Data Models
File: `prisma/schema.prisma`
- **Credential Model**: Stores `id`, `name`, `value` (the API key), `type` (Enum: `OPENAI`, `ANTHROPIC`, `GEMINI`), `createdAt`, `updatedAt`, and `userId` (relation to User).
- **Node Model Update**: Added an optional `credentialId` foreign key to `Node` to link workflow nodes to a specific user credential.

### 3.2 Backend Routers & State Management
Files: 
- `src/features/credentials/server/routers.ts`
- `src/features/credentials/params.ts`
- `src/features/credentials/server/prefetch.ts`
- **tRPC Router**: Implements CRUD procedures (`create`, `update`, `remove`, `getOne`, `getMany`, `getByType`). All queries are scoped to the authenticated user (`ctx.auth.user.id`).
- **URL State**: Pagination (`page`, `pageSize`) and `search` are strictly typed and synced to the URL using `nuqs`.

### 3.3 UI Components
Files: 
- `src/features/credentials/components/credentials.tsx` (List view)
- `src/features/credentials/components/credential.tsx` (Form view)
- **List View**: Displays a searchable, paginated list of credentials with logos identifying the credential type. Includes empty states, error boundaries, and loading skeletons.
- **Form View**: A standard `react-hook-form` connected to a Zod schema. Allows users to name their API key, select the provider (Type), and input the secret value.

### 3.4 Integration with AI Nodes
Files: `src/features/executions/components/{gemini,openai,anthropic}/*`
- **Dialog Configuration**: Dialogs have been updated to include a dropdown field for users to select a credential of the corresponding type.
- **Executor Guards**: Before processing the AI task, the executor verifies that `data.credentialId` exists.

## 4. Validation, Errors, and Edge Cases

### Form Validation
- Creating or updating a credential requires a `name` and a `value` (the API key). The form will block submission and show inline errors if these fields are empty.

### Execution Safety
- If a user triggers a workflow but the required AI node lacks a selected credential (`!data.credentialId`), the executor immediately halts. It publishes a durable "error" state to the UI via Inngest and throws a `NonRetriableError` to prevent empty API calls.

### Deletion Safety
- The Prisma schema uses `onDelete: Cascade` for the `User -> Credential` relation and `onDelete: SET NULL` for the `Credential -> Node` relation. If a credential is deleted, any node relying on it will simply have a null `credentialId`, catching the missing credential error safely during execution rather than breaking the database constraints.

## 5. Assumptions & Open Questions

- **Security & Encryption**: Currently, the credential `value` (API keys) is stored as plain text in the database. There is a `TODO: Consider encrypting in production` note in the codebase. Moving forward, a server-side encryption mechanism (e.g., AES-256-GCM) should be implemented before persisting keys, and decryption should happen only in memory during executor runs.
- **Node Executor Fetching**: While the executors check for the presence of `credentialId`, they will need to fetch the actual decrypted credential value from the database using that ID in order to authenticate the API requests to the AI providers.
