# Google Forms Integration Spec

## 1. Overview
The Google Forms integration in Orbitron enables workflows to be automatically triggered whenever a user submits a specific Google Form. This effectively turns a simple Google Form into an interactive entry point for complex automation sequences.

When a form is submitted, the data is pushed to our webhook, which triggers the Inngest orchestration engine. The workflow receives the structured form data and propagates it through the pipeline, while providing real-time visual feedback (loading spinners, success ticks) on the React Flow canvas.

## 2. Architecture & Data Flow
The integration spans from Google Apps Script running on Google's infrastructure to our local Next.js environment running Inngest.

### Request / Response Lifecycle
1. **Form Submission**: A user submits a Google Form.
2. **Google Apps Script**: An `onFormSubmit(e)` script attached to the form captures the submission. It transforms the answers into a JSON map (`{ "Question Title": "Answer" }`) and issues an HTTP POST to our webhook URL.
3. **Webhook Receiver**: The `/api/webhooks/google-form` Next.js route receives the payload. It extracts the `workflowId` from the URL search parameters and formats the body payload.
4. **Trigger Inngest**: The webhook calls `sendWorkflowExecution()`, dispatching a `workflows/execute.workflow` event to the Inngest broker with `googleForm` embedded in `initialData`.
5. **Workflow Orchestrator**: The Inngest background job (`execute-workflow`) starts. It sorts the workflow nodes topologically.
6. **Node Execution**: The `googleFormTriggerExecutor` runs. It signals the UI that it is "loading", outputs the initial context, and then signals "success".
7. **Real-time Feedback**: The React Flow UI (`GoogleFormTriggerNode`), listening to the Inngest Realtime channel, updates its visual status based on the messages received, displaying a green checkmark on success.

## 3. Components Involved

### 3.1 Schema & Data Models
File: `prisma/schema.prisma`
- Added `GOOGLE_FORM_TRIGGER` to the `NodeType` enum.

### 3.2 UI Components
File: `src/features/triggers/components/google-form-trigger/node.tsx`
- **Responsibility**: Renders the trigger node on the workflow canvas.
- **State**: Uses `useNodeStatus` hook configured with `GOOGLE_FORM_TRIGGER_CHANNEL_NAME` to listen for Inngest Realtime messages.
- **Interaction**: Double-clicking the node opens the settings dialog.

### 3.3 Configuration Dialog & Script Generation
Files: 
- `src/features/triggers/components/google-form-trigger/dialog.tsx`
- `src/features/triggers/components/google-form-trigger/utils.ts`
- **Responsibility**: Provides the user with setup instructions and the generated Google Apps Script.
- **Script Details**: The `generateGoogleFormScript` dynamically embeds the webhook URL (using `NEXT_PUBLIC_APP_URL` or localhost) and includes the `workflowId` parameter. It maps `itemResponse.getItem().getTitle()` to `itemResponse.getResponse()` to create an intuitive data payload.

### 3.4 Webhook Endpoint
File: `src/app/api/webhooks/google-form/route.ts`
- **Responsibility**: Serves as the public endpoint for Google Forms.
- **Validation**: Rejects requests missing the `workflowId` query parameter.
- **Data Structure**: Extracts `formId`, `formTitle`, `responseId`, `timestamp`, `respondentEmail`, and the `responses` mapping, forwarding them into the workflow's `initialData`.

### 3.5 Execution & State Management
Files: 
- `src/features/triggers/components/google-form-trigger/executor.ts`
- `src/inngest/channels/google-form-trigger.ts`
- **Responsibility**: Orchestrates the backend state during workflow execution.
- **Realtime Comms**: Emits status updates to the UI so users see the progress of the workflow in real time.

## 4. History and Evolution (Bug Fixes & Refactors)

### 4.1 Prisma Connection Exhaustion
**What changed:** HMR (Hot Module Replacement) in local development was instantiating multiple `pg.Pool` and `PrismaPg` adapters on every save.
**Impact:** Background Inngest workers were failing to connect to the database (throwing `Invalid prisma.workflow.findUniqueOrThrow() invocation`), causing the workflow orchestrator to crash before reaching the Google Form executor.
**Current Behavior:** The connection pool is strictly cached in `globalForPrisma` alongside the PrismaClient to survive HMR reloads.

### 4.2 Inngest Realtime Replay Bug
**What changed:** Re-architected how real-time publish events are emitted from executors.
**Previous Behavior:** `inngest.realtime.publish()` was called repeatedly inside the function body, outside of `step.run()`. Because Inngest uses deterministic replays, every time a new node's `step.run()` paused the function, the function would replay from the top, causing the Google Form trigger to emit duplicate "loading" and "success" messages indefinitely.
**Current Behavior:** 
- The initial "loading" state is emitted using `inngest.realtime.publish` (which is non-durable and suitable for transient UI state).
- The "success" state is emitted using `step.realtime.publish()` (Inngest v4's durable, memoized publish function) so that it survives replays without firing redundantly.

### 4.3 Duplicate Step ID Bug
**What changed:** Appended `${nodeId}` to Inngest step names.
**Previous Behavior:** Executors hardcoded step names like `step.run("google-form-trigger")`. If a user dragged two identical nodes onto the canvas, Inngest would crash due to duplicate step IDs or mistakenly skip executing the second node.
**Current Behavior:** Step names use string interpolation `google-form-trigger-${nodeId}-execute` guaranteeing uniqueness across the workflow orchestration.

## 5. Security & Edge Cases

### Security Considerations
1. **Unauthenticated Webhooks**: The current Google Form webhook (`/api/webhooks/google-form`) is unauthenticated. Anyone possessing the webhook URL and workflow ID could simulate a form submission by sending a POST request. In a production environment, this could be abused to run up computation bills.
2. **Ngrok SSL limitations**: During local dev, we rely on Ngrok. Google Apps Script's `UrlFetchApp.fetch` requires a valid SSL certificate, which Ngrok provides, but if developers attempt to run this over raw HTTP locally, Google Apps Script will refuse to dispatch the request.

### Error Handling
- If `workflowId` is omitted, the API responds with a 400 Bad Request.
- If the Inngest execution broker is unreachable, it logs to `console.error` and returns a 500.

## 6. Future Maintenance & Technical Debt

### Known Limitations
- **No Signature Verification**: We do not currently cryptographically verify that the payload originated from Google.
- **Hardcoded Default Variables**: Users must manually parse the JSON. We provide Handlebars helpers (`{{googleForm.respondentEmail}}`), but there is no graphical auto-complete for Google Form fields in the UI.

### Extension Points
1. **Adding Authentication**: We could generate a secure API key for the webhook and embed it in the Google Apps script header (e.g., `Authorization: Bearer <key>`) to prevent arbitrary execution.
2. **Schema Introspection**: We could prompt the user to link their Google account via OAuth to introspect the Google Form fields automatically and populate the variables dropdown, avoiding manual string keys.

### Things to Avoid Changing
- **DO NOT** wrap `inngest.realtime.publish` inside a standard `step.run()` or rely on it for permanent state changes inside an execution loop. Always prefer `step.realtime.publish` for state transitions to avoid replay storms.
- **DO NOT** modify the channel namespace (`GOOGLE_FORM_TRIGGER_CHANNEL_NAME`) without simultaneously updating the React Hook `useNodeStatus` topics. A mismatch will cause the UI to silently fail to receive real-time updates.
