# Discord & Slack Nodes Integration Spec

## 1. Overview
The Discord and Slack Nodes integration introduces two new execution nodes into Orbitron: **Discord** and **Slack**. These nodes enable automated workflows to send outgoing messages to designated channels on these platforms via Webhooks.

By utilizing these nodes, a workflow can push notifications, summaries, or alerts generated from previous steps (like AI generation or triggers) directly to a team's communication channels.

## 2. Architecture & Data Flow
The integration uses the Orbitron workflow engine to compile template strings and dispatch HTTP POST requests to configured Discord or Slack webhook URLs.

### Execution Lifecycle
1. **Node Configuration**: A user drags a Discord or Slack node onto the canvas and configures it via its settings dialog. The user provides a `variableName` (to store the payload output in the context), a required `webhookUrl`, the message `content`, and (for Discord only) an optional `username` override.
2. **Template Compilation**: When the workflow reaches the node, the executor retrieves the current workflow `context`. It uses Handlebars to compile the `content` (and `username` for Discord), injecting dynamic data from previous nodes (e.g., `{{myGemini.text}}`). 
3. **HTML Entity Decoding**: The compiled templates are passed through `html-entities` (`decode`) to ensure symbols and special characters render correctly on the destination platform.
4. **Status Update (Loading)**: The executor publishes a non-durable "loading" state via `inngest.realtime.publish`. The React Flow node receives this via the `useNodeStatus` hook and updates the UI accordingly.
5. **Webhook Execution**: The executor calls the webhook URL via an HTTP POST request using `ky`. 
   - For Discord, the payload is `{ content, username }`, and the content is strictly truncated to 2000 characters to prevent API rejection.
   - For Slack, the payload is `{ content }`.
   - The execution is wrapped securely inside an Inngest `step.run()` block to ensure memoization and resilience.
6. **Context Hydration**: The transmitted message content is extracted and injected into the workflow context under the user-defined `variableName` (e.g., `context.myDiscord.messageContent`).
7. **Status Update (Completion)**: Upon success or failure, the executor publishes a durable state ("success" or "error") via `step.realtime.publish()`, updating the UI to display a success or failure indicator.

## 3. Components Involved

### 3.1 Schema & Data Models
File: `prisma/schema.prisma`
- Added `DISCORD` and `SLACK` to the `NodeType` enum.

### 3.2 UI Components
Files: `src/features/executions/components/{discord,slack}/node.tsx`
- **Responsibility**: Renders the specific messaging node on the React Flow canvas.
- **State**: Uses the `useNodeStatus` hook configured with the respective channel name (e.g., `DISCORD_CHANNEL_NAME`) to listen for real-time execution updates.
- **Interaction**: Displays the beginning of the configured `content` as the node description. Double-clicking or clicking the settings icon opens the configuration dialog.

### 3.3 Configuration Dialog
Files: `src/features/executions/components/{discord,slack}/dialog.tsx`
- **Responsibility**: Provides the form for users to configure the node.
- **Fields**:
  - `variableName` (String, regex validated): The key where the outgoing message content will be stored.
  - `webhookUrl` (String, required): The destination URL provided by the platform.
  - `content` (Textarea, required): The message template to send.
  - `username` (String, optional, Discord only): Overrides the webhook's default bot username.
- **Templating**: Informs the user they can use `{{variables}}` for simple text injection or `{{json variable}}` to stringify objects.

### 3.4 Execution & State Management
Files: 
- `src/features/executions/components/{discord,slack}/executor.ts`
- `src/inngest/channels/{discord,slack}.ts`
- `src/inngest/channels/constants.ts`
- `src/features/executions/components/{discord,slack}/actions.ts`
- `src/features/executions/lib/executor-registry.ts`
- `src/config/node-components.ts`

- **Responsibility**: Orchestrates backend execution and real-time UI updates.
- **Inngest v4 Realtime**: Adheres strictly to Orbitron's Inngest v4 patterns. Channels are defined using `realtime.channel()` with Zod schemas. Channel names are isolated in `constants.ts`. Realtime tokens are generated via `getClientSubscriptionToken` in Server Actions.

## 4. Validation, Errors, and Edge Cases

### Configuration Validation
- If a user configures a node but leaves `variableName`, `content`, or `webhookUrl` empty, the executor will detect this at runtime.
- It will durably publish an "error" status to the UI and throw an Inngest `NonRetriableError` (e.g., "Discord node: Message content is required"), halting execution before any HTTP call is made.

### Execution Constraints & Webhook Errors
- **Discord Character Limits**: Discord enforces a 2000-character limit for message content. The executor automatically truncates the evaluated Handlebars output to 2000 characters before sending it to the webhook.
- **Network / HTTP Errors**: Invalid webhook URLs, revoked webhook tokens, or network failures will cause `ky.post` to throw.
- **Error Handling**: The executor wraps the execution in a `try/catch` block. If an error occurs, it durably publishes an "error" status to the UI via `step.realtime.publish` before re-throwing the error to Inngest for standard retry and failure handling.

## 5. Assumptions & Open Questions

- **Slack Payload Structure**: The current Slack executor passes `{ content: ... }` as the JSON payload. Depending on the specific Slack incoming webhook configuration or Workflow Builder setup, Slack might expect a `{ text: ... }` key instead. Users must ensure their Slack workflows are configured to expect a `content` variable, as noted in the dialog description.
- **Credential / Secret Management**: Webhook URLs are currently stored in plain text within the node's JSON `data` configuration on the canvas. While convenient, this exposes the Webhook URL in the UI. A future iteration might consider moving these into a dedicated `Credentials` vault similar to AI API keys.
- **Upstream Deviations**: The original NodeBase implementation proposed modifications to standard AI executors to inject a `userId` for scoping credentials. This was intentionally excluded from the Orbitron port, as Discord and Slack nodes do not query internal credentials, and applying a global `userId` parameter diverges from Orbitron's existing patterns.
