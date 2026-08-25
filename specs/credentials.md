# User Credentials Management Spec

## Table of Contents
1. [Overview](#1-overview)
2. [Why This Feature is Needed](#2-why-this-feature-is-needed)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [Schema & Data Models](#4-schema--data-models)
5. [Encryption at Rest](#5-encryption-at-rest)
6. [Backend Routers & State Management](#6-backend-routers--state-management)
7. [UI Components](#7-ui-components)
8. [Integration with AI Nodes](#8-integration-with-ai-nodes)
9. [Validation, Errors, and Edge Cases](#9-validation-errors-and-edge-cases)
10. [Dependencies](#10-dependencies)
11. [File Inventory](#11-file-inventory)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Assumptions & Open Questions](#13-assumptions--open-questions)

---

## 1. Overview

The Credentials Management feature in Orbitron introduces a secure, centralized way for users to manage third-party API keys and credentials (such as OpenAI, Anthropic, and Gemini keys). 

Instead of relying on global environment variables, users can create, update, and manage their own credentials through the dashboard. These credentials can then be dynamically attached to specific workflow nodes (e.g., AI Nodes) directly from the node configuration dialog on the canvas.

All credential values (API keys) are **encrypted at rest** using AES-256-GCM before being persisted to the database. Decryption happens exclusively in server-side executor code at the moment the credential is needed to initialize an AI provider client. Plaintext API keys are never stored in the database and never exposed to client-side code.

## 2. Why This Feature is Needed

In a multi-tenant production environment, relying on global environment variables (`OPENAI_API_KEY`, etc.) for AI provider authentication is unacceptable:

- **Multi-tenancy**: Each user needs to supply and manage their own API keys.
- **Security**: API keys stored in plaintext in the database risk exposure through database breaches, backups, or unauthorized access.
- **Isolation**: A user's credentials should only be accessible to that user's authenticated sessions and their own workflow executions.
- **Compliance**: Encrypting secrets at rest is a baseline security requirement for any production system handling third-party API keys.

## 3. Architecture & Data Flow

The integration relies on a full-stack tRPC architecture with server-side rendering support, client-side URL state management, and server-side encryption.

### Credentials Lifecycle

```
User submits API key via UI form
        ↓
Zod validation (name, type, value required)
        ↓
tRPC protectedProcedure (server-side)
        ↓
encrypt(value) via cryptr (AES-256-GCM)
        ↓
Encrypted ciphertext stored in PostgreSQL (Credential.value)
        ↓
        ... (later, during workflow execution) ...
        ↓
Executor fetches Credential record from database
        ↓
decrypt(credential.value) via cryptr (server-side only)
        ↓
Decrypted plaintext API key used to initialize provider SDK
        ↓
Provider client makes authenticated API call
        ↓
Plaintext key discarded (not persisted or forwarded)
```

1. **Creation/Editing**: Users navigate to the `/credentials` route to view a paginated, searchable list of their stored API keys. From here, they can add a new credential or edit an existing one. The form validates the input using Zod and sends a mutation via tRPC. On the server, the credential `value` is **encrypted** using the `encrypt()` function from `src/lib/encryption.ts` before being stored in the PostgreSQL database via Prisma.
2. **Server-Side Hydration**: The credentials list and details pages utilize Next.js Server Components. Data is prefetched on the server using `prefetchCredentials` and hydrated into the client via `<HydrateClient>`. URL search params for pagination and search are managed using `nuqs`. Note: The `value` field returned to the client contains **encrypted ciphertext**, not plaintext.
3. **Workflow Integration**: When a user configures a node that requires authentication (like the OpenAI node), the node dialog uses the `useCredentialsByType` hook to fetch and display only the relevant credentials. The selected `credentialId` is saved to the Node's data payload. The dialog only needs the credential `id` and `name` for selection — it does not need the `value`.
4. **Execution**: During a workflow execution run, the executor checks the node's `data.credentialId`. If missing, the execution fails with a descriptive error. The executor fetches the credential record from the database using Prisma, then **decrypts** the `value` field using the `decrypt()` function to obtain the plaintext API key. This plaintext key is used exclusively to initialize the AI provider SDK client within the server-side Inngest step, and is never persisted or forwarded beyond that scope.

## 4. Schema & Data Models

File: `prisma/schema.prisma`

### Credential Model
```prisma
model Credential {
  id        String         @id @default(cuid())
  name      String
  value     String          // Stores AES-256-GCM encrypted ciphertext (not plaintext)
  type      CredentialType
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  Node Node[]
}

enum CredentialType {
  OPENAI
  ANTHROPIC
  GEMINI
}
```

- **`value` column**: Stores the AES-256-GCM encrypted ciphertext produced by the `cryptr` library. The encrypted representation is a hex-encoded string. PostgreSQL's `String` (TEXT) type accommodates this without length issues, as the encrypted output is approximately 2–3x the length of the original plaintext.
- **No schema migration required**: The column type (`String`) remains unchanged. Only the content semantics changed from plaintext to ciphertext.

### Node Model Update
- Added an optional `credentialId` foreign key to `Node` to link workflow nodes to a specific user credential.
- Uses `onDelete: SET NULL` so that deleting a credential nullifies the reference rather than cascading to the node.

## 5. Encryption at Rest

### Why
The credential `value` field contains third-party API keys (e.g., OpenAI, Anthropic, Gemini keys). Storing these in plaintext exposes them to risk through database breaches, backups, log dumps, or unauthorized database access. Server-side encryption at rest ensures the database never contains usable secrets.

### Implementation

File: `src/lib/encryption.ts`

```typescript
import Cryptr from "cryptr";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is not set. " +
    "Please set a stable, random 32+ character string in your .env file. " +
    "Changing this key will make previously encrypted credentials undecryptable."
  );
}

const cryptr = new Cryptr(ENCRYPTION_KEY);

export const encrypt = (text: string) => cryptr.encrypt(text);
export const decrypt = (text: string) => cryptr.decrypt(text);
```

### Algorithm
- **Library**: `cryptr` (v6.4.0)
- **Algorithm**: AES-256-GCM (applied internally by `cryptr`)
- **Key derivation**: The `ENCRYPTION_KEY` environment variable is used as the encryption secret. `cryptr` derives the actual AES key internally from this secret.
- **Output format**: Hex-encoded string containing the IV, auth tag, and ciphertext.

### Key Management

- **Environment variable**: `ENCRYPTION_KEY` must be set in the `.env` file (or equivalent environment configuration for deployment).
- **Stability requirement**: The encryption key **must remain the same** across application restarts and deployments. Changing the key will make all previously encrypted credentials permanently undecryptable.
- **Missing key behavior**: If `ENCRYPTION_KEY` is not set, the module throws a descriptive `Error` at import time, preventing the application from starting. This fail-fast behavior ensures the system never silently falls back to storing credentials unencrypted.
- **Key format**: A random string of 32+ characters is recommended. The key should never be committed to source control in production.

### Security Boundaries

| Boundary | Plaintext Exposed? | Notes |
|---|---|---|
| Client-side UI (browser) | **No** | `getMany`, `getByType`, `getOne` queries return encrypted ciphertext in the `value` field. The client never receives usable API keys. |
| tRPC mutation (server) | **Briefly** | The plaintext value arrives via the tRPC mutation input, is encrypted immediately via `encrypt()`, and the plaintext is not persisted. |
| Database (PostgreSQL) | **No** | Only AES-256-GCM ciphertext is stored in the `value` column. |
| Executor (Inngest step) | **Briefly** | The ciphertext is decrypted via `decrypt()` only at the moment the AI provider client is initialized. The plaintext key is used for the API call and then discarded. |
| Logs / Error messages | **No** | Encryption and decryption errors do not include the plaintext key or the raw ciphertext in their error messages. |
| Workflow serialization | **No** | Credentials are referenced by `credentialId` in node data, not by value. The `value` is fetched separately during execution. |

### Encryption Points

The `encrypt()` function is called in exactly two places in the credential tRPC router (`src/features/credentials/server/routers.ts`):

1. **`create` mutation**: `value: encrypt(value)` — encrypts the API key before the initial `prisma.credential.create()` call.
2. **`update` mutation**: `value: encrypt(value)` — encrypts the new API key before the `prisma.credential.update()` call. Since updates always require a `value` field (per the Zod schema), every update re-encrypts the provided value.

### Decryption Points

The `decrypt()` function is called in exactly three executor files, all following the same pattern:

1. **OpenAI executor** (`src/features/executions/components/openai/executor.ts`): `apiKey: decrypt(credential.value)`
2. **Anthropic executor** (`src/features/executions/components/anthropic/executor.ts`): `apiKey: decrypt(credential.value)`
3. **Gemini executor** (`src/features/executions/components/gemini/executor.ts`): `apiKey: decrypt(credential.value)`

In each case, the decrypted plaintext is passed directly to the provider SDK factory function (`createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`) as the `apiKey` parameter. The decrypted value is not stored in any variable with a longer lifetime than the immediate function scope.

## 6. Backend Routers & State Management

Files: 
- `src/features/credentials/server/routers.ts`
- `src/features/credentials/params.ts`
- `src/features/credentials/server/prefetch.ts`

### tRPC Router

Implements CRUD procedures (`create`, `update`, `remove`, `getOne`, `getMany`, `getByType`). All queries are scoped to the authenticated user (`ctx.auth.user.id`).

| Procedure | Type | Auth | Encryption Behavior |
|---|---|---|---|
| `create` | Mutation | `protectedProcedure` | Encrypts `value` before `prisma.credential.create()` |
| `update` | Mutation | `protectedProcedure` | Encrypts `value` before `prisma.credential.update()` |
| `remove` | Mutation | `protectedProcedure` | No encryption involvement |
| `getOne` | Query | `protectedProcedure` | Returns record as-is (value is ciphertext) |
| `getMany` | Query | `protectedProcedure` | Returns records as-is (values are ciphertext) |
| `getByType` | Query | `protectedProcedure` | Returns records as-is (values are ciphertext) |

### URL State
Pagination (`page`, `pageSize`) and `search` are strictly typed and synced to the URL using `nuqs`.

## 7. UI Components

Files: 
- `src/features/credentials/components/credentials.tsx` (List view)
- `src/features/credentials/components/credential.tsx` (Form view)

- **List View**: Displays a searchable, paginated list of credentials with logos identifying the credential type. Includes empty states, error boundaries, and loading skeletons. The list does not display credential values.
- **Form View**: A standard `react-hook-form` connected to a Zod schema. Allows users to name their API key, select the provider (Type), and input the secret value. On submission, the plaintext value is sent to the server via tRPC where it is encrypted before persistence. The form always requires the full credential value for both creation and editing.

## 8. Integration with AI Nodes

Files: `src/features/executions/components/{gemini,openai,anthropic}/*`

- **Dialog Configuration**: Dialogs include a dropdown field for users to select a credential of the corresponding type. Only `credentialId` is stored in the node's data payload.
- **Executor Guards**: Before processing the AI task, the executor verifies that `data.credentialId` exists.
- **Credential Fetching**: The executor fetches the credential record from the database using `prisma.credential.findUnique()` within an Inngest `step.run()` block.
- **Decryption**: The encrypted `credential.value` is decrypted using `decrypt()` and passed as `apiKey` to the respective provider SDK factory (`createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`).

## 9. Validation, Errors, and Edge Cases

### Form Validation
- Creating or updating a credential requires a `name` (min 1 char) and a `value` (min 1 char, the API key). The form will block submission and show inline errors if these fields are empty.
- The `type` field must be one of the `CredentialType` enum values (`OPENAI`, `ANTHROPIC`, `GEMINI`).

### Encryption Errors

| Scenario | Behavior |
|---|---|
| `ENCRYPTION_KEY` not set | Application fails to start with a descriptive error message. The encryption module throws at import time. |
| `ENCRYPTION_KEY` changed after credentials were stored | Previously encrypted credentials will fail to decrypt. The `decrypt()` call will throw an error. The executor will catch this and surface a safe error through Inngest's error handling. |
| Invalid ciphertext passed to `decrypt()` | `cryptr.decrypt()` throws an error. The error does not contain the plaintext key. The executor's `try/catch` block handles this gracefully. |
| Empty string passed to `encrypt()` | `cryptr` will encrypt the empty string. However, the Zod schema enforces `min(1)` on the `value` field, so this case is prevented at the validation layer. |

### Execution Safety
- If a user triggers a workflow but the required AI node lacks a selected credential (`!data.credentialId`), the executor immediately halts. It publishes a durable "error" state to the UI via Inngest and throws a `NonRetriableError` to prevent empty API calls.
- If the credential record is not found in the database (e.g., it was deleted after the node was configured), the executor throws a `NonRetriableError` with the message `"[Provider] node: Credential not found"`.
- If the decrypted API key is invalid (e.g., expired or revoked), the AI provider SDK will throw during the `generateText` call. The executor's `try/catch` publishes a durable "error" status before re-throwing.

### Deletion Safety
- The Prisma schema uses `onDelete: Cascade` for the `User -> Credential` relation and `onDelete: SET NULL` for the `Credential -> Node` relation. If a credential is deleted, any node relying on it will simply have a null `credentialId`, catching the missing credential error safely during execution rather than breaking the database constraints.

### Backward Compatibility
- **Pre-existing plaintext credentials**: If any credentials were stored in the database before encryption was implemented, they will fail to decrypt when an executor attempts to use them. The `decrypt()` function will throw an error because the stored value is not valid ciphertext. To fix this, users must re-save the credential through the UI, which will encrypt the new value before persistence.
- **No automatic migration**: There is no automated migration that encrypts existing plaintext credentials. This is intentional — the system cannot distinguish between a plaintext API key and corrupted ciphertext, and silently encrypting existing values could mask data integrity issues.

## 10. Dependencies

| Dependency | Version | Purpose | Server/Client |
|---|---|---|---|
| `cryptr` | ^6.4.0 | AES-256-GCM encryption/decryption of credential values | Server-only |

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ENCRYPTION_KEY` | **Yes** | Secret key used by `cryptr` for AES-256-GCM encryption. Must be a stable, random 32+ character string. Must not change after credentials have been encrypted. |

## 11. File Inventory

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Credential model definition, CredentialType enum, Node-Credential relation |
| `src/lib/encryption.ts` | Server-side encryption/decryption utility using `cryptr` and `ENCRYPTION_KEY` |
| `src/features/credentials/server/routers.ts` | tRPC CRUD router with encryption on create/update mutations |
| `src/features/credentials/server/prefetch.ts` | Server-side data prefetching for SSR |
| `src/features/credentials/params.ts` | URL state parameters (pagination, search) via `nuqs` |
| `src/features/credentials/hooks/use-credentials-by-type.ts` | Client hook to fetch credentials filtered by provider type |
| `src/features/credentials/components/credentials.tsx` | Credentials list view UI |
| `src/features/credentials/components/credential.tsx` | Credential create/edit form UI |
| `src/features/executions/components/openai/executor.ts` | OpenAI executor with credential decryption |
| `src/features/executions/components/anthropic/executor.ts` | Anthropic executor with credential decryption |
| `src/features/executions/components/gemini/executor.ts` | Gemini executor with credential decryption |

## 12. Acceptance Criteria

1. **Encryption on creation**: When a user creates a new credential via the UI, the `value` stored in the database is AES-256-GCM encrypted ciphertext, not the plaintext API key.
2. **Encryption on update**: When a user updates an existing credential, the new `value` is encrypted before persistence.
3. **Decryption at execution**: When a workflow runs and reaches an AI node (OpenAI, Anthropic, or Gemini), the executor decrypts the stored credential value and passes the plaintext API key to the provider SDK.
4. **No plaintext in database**: At no point after this feature is implemented should a credential `value` column contain a plaintext API key for any newly created or updated credential.
5. **No client-side decryption**: The `decrypt()` function is never imported or called in client-side code. All decryption happens in server-side executor code.
6. **Missing key fails fast**: If `ENCRYPTION_KEY` is not set, the application fails to start with a clear error message.
7. **Key stability**: The encryption key must remain stable. Changing it renders previously encrypted credentials permanently unusable.
8. **Provider execution works end-to-end**: After encryption is implemented, AI nodes continue to function correctly — the user creates a credential, assigns it to an AI node, runs the workflow, and the AI provider receives a valid decrypted API key.
9. **Build passes**: `pnpm build` completes without TypeScript or compilation errors.

## 13. Assumptions & Open Questions

- **No read-side filtering of `value`**: The `getMany`, `getByType`, and `getOne` queries return the full credential record including the encrypted `value` to the client. While this is safe (the value is ciphertext), a future improvement could omit the `value` field from query responses entirely using Prisma's `select` or `omit`, since the client never needs it.
- **Model Selection**: The models are currently hardcoded in the executors (e.g., `gemini-2.0-flash`, `gpt-4`, `claude-sonnet-4-5`). Future iterations could expose a dropdown in the configuration dialog allowing users to select specific models.
- **Additional credential types**: If new credential types are added to `CredentialType` (e.g., for Slack, Discord, or other integrations), their executors should follow the same pattern of calling `decrypt()` on the credential value before use.
- **Key rotation**: There is currently no support for encryption key rotation. If the `ENCRYPTION_KEY` needs to be changed, all existing credentials must be re-saved through the UI. A future migration utility could be built to re-encrypt existing credentials with a new key.
