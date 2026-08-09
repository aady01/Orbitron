# Stripe Trigger Integration Spec

## 1. Overview
The Stripe integration in Orbitron enables workflows to be automatically triggered whenever a specific event occurs in Stripe (e.g., a payment succeeds, a subscription is created, etc.). This acts as a webhook listener for Stripe events.

When an event occurs in Stripe, it fires a webhook payload to our Next.js route, which then triggers the Inngest orchestration engine. The workflow receives the structured Stripe event data and processes the pipeline, while providing real-time visual feedback (loading spinners, success ticks) on the React Flow canvas via Inngest's v4 realtime capabilities.

## 2. Architecture & Data Flow
The integration spans from Stripe's infrastructure (webhooks) to our local Next.js environment running Inngest.

### Request / Response Lifecycle
1. **Event Triggered**: An event occurs in the user's Stripe account (e.g., `payment_intent.succeeded`).
2. **Stripe Webhook**: Stripe fires a POST request with a JSON payload of the event data to the configured Orbitron webhook URL.
3. **Webhook Receiver**: The `/api/webhooks/stripe` Next.js route receives the payload. It extracts the `workflowId` from the URL search parameters and maps the Stripe payload to a standard structure.
4. **Trigger Inngest**: The webhook calls `sendWorkflowExecution()`, dispatching a `workflows/execute.workflow` event to the Inngest broker with the `stripe` event details embedded in `initialData`.
5. **Workflow Orchestrator**: The Inngest background job (`execute-workflow`) starts and sorts the workflow nodes topologically.
6. **Node Execution**: The `stripeTriggerExecutor` runs. It signals the UI that it is "loading" via a non-durable publish, outputs the initial context, and then signals "success" via a durable publish.
7. **Real-time Feedback**: The React Flow UI (`StripeTriggerNode`), listening to the Inngest Realtime channel, updates its visual status based on the messages received, displaying a green checkmark on success.

## 3. Components Involved

### 3.1 Schema & Data Models
File: `prisma/schema.prisma`
- Added `STRIPE_TRIGGER` to the `NodeType` enum.

### 3.2 UI Components
File: `src/features/triggers/components/stripe-trigger/node.tsx`
- **Responsibility**: Renders the Stripe trigger node on the workflow canvas.
- **State**: Uses `useNodeStatus` hook configured with `STRIPE_TRIGGER_CHANNEL_NAME` to listen for Inngest Realtime messages. Uses `fetchStripeTriggerRealtimeToken` to obtain the realtime subscription token.
- **Interaction**: Double-clicking the node opens the settings dialog.

### 3.3 Configuration Dialog
File: `src/features/triggers/components/stripe-trigger/dialog.tsx`
- **Responsibility**: Provides the user with setup instructions to configure the webhook in the Stripe Developer Dashboard.
- **Webhook Details**: Displays the dynamically generated webhook URL including the `workflowId` parameter. It also shows a copy button and documentation for available variables like `{{stripe.amount}}`, `{{stripe.currency}}`, etc.

### 3.4 Webhook Endpoint
File: `src/app/api/webhooks/stripe/route.ts`
- **Responsibility**: Serves as the public webhook endpoint for Stripe events.
- **Validation**: Rejects requests missing the `workflowId` query parameter (400 Bad Request).
- **Data Structure**: Extracts event metadata like `eventId`, `eventType`, `timestamp`, `livemode`, and the `raw` data object, forwarding them into the workflow's `initialData.stripe`.

### 3.5 Execution & State Management
Files:
- `src/features/triggers/components/stripe-trigger/executor.ts`
- `src/inngest/channels/stripe-trigger.ts`
- `src/inngest/channels/constants.ts`
- **Responsibility**: Orchestrates the backend state during workflow execution.
- **Realtime Comms**: Uses Inngest v4 realtime API with Zod validation. Emits non-durable "loading" state updates via `inngest.realtime.publish`, and durable "success" states via `step.realtime.publish`. Uses `${nodeId}` in step names to prevent duplicate ID bugs.

## 4. Inngest v4 Compliance
Unlike legacy implementations (v3), the Stripe Trigger strictly adheres to Orbitron's v4 patterns:
- No `publish` function is passed as a parameter to the executor. The `inngest` client is imported directly.
- Channels are defined using `realtime.channel()` with a Zod schema.
- The channel name string is isolated in `constants.ts` to prevent server SDK bundling issues in client components.
- Realtime tokens are generated using `getClientSubscriptionToken` from `inngest/react` in server actions.

## 5. Assumptions & Open Questions
- **Stripe Signature Verification**: The current implementation blindly trusts incoming webhook requests without verifying Stripe's `Stripe-Signature` header. For production safety, we should add signature verification using Stripe's official SDK or standard crypto modules.
- **Payload Constraints**: Next.js App Router might truncate or fail on very large Stripe payload bodies depending on limits. Ensure standard payload sizes fit within API route limits.
