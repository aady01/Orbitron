# AI Nodes (Gemini, OpenAI, Anthropic) Integration Spec

## 1. Overview
The AI Nodes integration in Orbitron introduces three new execution nodes: **Gemini**, **OpenAI**, and **Anthropic**. These nodes empower users to seamlessly embed Large Language Model (LLM) text generation capabilities directly into their automated workflows. 

By utilizing these nodes, a workflow can intelligently process data—such as summarizing HTTP responses, generating emails based on form submissions, or analyzing text—rather than relying strictly on deterministic data transformations.

## 2. Architecture & Data Flow
The integration bridges the Orbitron workflow engine (powered by Inngest) with the official AI SDKs (`@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`).

### Execution Lifecycle
1. **Node Configuration**: A user drags an AI node onto the canvas and configures it via a dialog, specifying a `variableName` (to store the output), an optional `systemPrompt`, and a required `userPrompt`.
2. **Template Compilation**: When the workflow reaches the AI node, the executor retrieves the current workflow `context`. It uses Handlebars to compile the `systemPrompt` and `userPrompt`, injecting dynamic data from previous nodes (e.g., `{{googleForm.respondentEmail}}`).
3. **Status Update (Loading)**: The executor immediately publishes a non-durable "loading" state via `inngest.realtime.publish`. The React Flow node receives this via the `useNodeStatus` hook and displays a loading spinner.
4. **AI Execution**: The executor calls the respective AI provider's API using the Vercel AI SDK. This external network call is wrapped securely inside an Inngest `step.run()` block to ensure it is memoized and resilient to workflow retries.
5. **Context Hydration**: The generated text is extracted from the response and injected into the workflow context under the user-defined `variableName` (e.g., `context.mySummary.text`).
6. **Status Update (Completion)**: Upon success or failure, the executor publishes a durable state ("success" or "error") via `step.realtime.publish()`, updating the UI to show a green checkmark or a red error icon.

## 3. Components Involved

### 3.1 Schema & Data Models
File: `prisma/schema.prisma`
- Added `GEMINI`, `OPENAI`, and `ANTHROPIC` to the `NodeType` enum.

### 3.2 UI Components
Files: `src/features/executions/components/{gemini,openai,anthropic}/node.tsx`
- **Responsibility**: Renders the specific AI node on the React Flow canvas.
- **State**: Uses the `useNodeStatus` hook configured with the respective channel name (e.g., `GEMINI_CHANNEL_NAME`) to listen for real-time execution updates.
- **Interaction**: Displays the beginning of the configured user prompt as the node description. Double-clicking opens the configuration dialog.

### 3.3 Configuration Dialog
Files: `src/features/executions/components/{gemini,openai,anthropic}/dialog.tsx`
- **Responsibility**: Provides the form for users to configure the node.
- **Fields**:
  - `variableName` (String, regex validated): The key where the output will be stored.
  - `systemPrompt` (Textarea, optional): Defines AI behavior.
  - `userPrompt` (Textarea, required): The main instruction/query.
- **Templating**: Informs the user they can use `{{variables}}` for simple text injection or `{{json variable}}` to stringify objects.

### 3.4 Execution & State Management
Files: 
- `src/features/executions/components/{gemini,openai,anthropic}/executor.ts`
- `src/inngest/channels/{gemini,openai,anthropic}.ts`
- `src/inngest/channels/constants.ts`
- `src/features/executions/components/{gemini,openai,anthropic}/actions.ts`

- **Responsibility**: Orchestrates the backend execution and real-time UI updates.
- **Inngest v4 Realtime**: Adheres strictly to Orbitron's Inngest v4 patterns. Channels are defined using `realtime.channel()` with Zod schemas. Channel names are isolated in `constants.ts`. Realtime tokens are generated via `getClientSubscriptionToken` in Server Actions.
- **Handlebars Helper**: A custom `{{json ...}}` Handlebars helper is registered to allow users to easily dump structured JSON context into prompts.

## 4. Validation, Errors, and Edge Cases

### Configuration Validation
- If a user configures a node but leaves the `variableName` or `userPrompt` empty, the executor will detect this at runtime.
- It will durably publish an "error" status to the UI and throw an Inngest `NonRetriableError`, halting the workflow execution immediately to prevent wasted API calls.

### API Errors
- Network failures, invalid API keys, or rate limits from the AI providers will cause the `generateText` call to throw.
- The executor wraps the execution in a `try/catch` block. If an error occurs, it durably publishes an "error" status to the UI via `step.realtime.publish` before re-throwing the error to Inngest for standard retry/failure handling.

## 5. Assumptions & Open Questions

- **API Key Management**: Currently, the executors pull provider credentials directly from global environment variables (`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). A `TODO` exists in the code to implement a user-specific credential selection mechanism. In a multi-tenant production environment, users should be able to provide and select their own API keys via the UI.
- **Model Selection**: The models are currently hardcoded in the executors (e.g., `gemini-2.0-flash`, `gpt-4`, `claude-sonnet-4-5`). Future iterations could expose a dropdown in the configuration dialog allowing users to select specific models based on cost/performance tradeoffs.
