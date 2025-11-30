import { requireAuth } from "@/lib/auth-utils"
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { WorkflowsContainer, WorkflowsList } from "@/features/workflows/components/workflows";
import { prefetchWorkflows } from "@/features/workflows/server/prefetch";

export default async function page() {
    await requireAuth();
    await prefetchWorkflows();
    return (
        <WorkflowsContainer>
            <HydrateClient>
                <ErrorBoundary fallback={<p> Error ! </p>}>
                    <Suspense fallback={<p>Loading...</p>}>
                        <WorkflowsList />
                    </Suspense>
                </ErrorBoundary>
            </HydrateClient>
        </WorkflowsContainer>
    )
}
