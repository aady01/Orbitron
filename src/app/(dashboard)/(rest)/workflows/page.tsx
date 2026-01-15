import { requireAuth } from "@/lib/auth-utils"
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
    WorkflowsContainer,
    WorkflowsList,
    WorkflowsLoading,
} from "@/features/workflows/components/workflows";
import { prefetchWorkflows } from "@/features/workflows/server/prefetch";
import type { SearchParams } from "nuqs";
import { workflowParamsLoaders } from "@/features/workflows/server/params-loader";
import { ErrorView } from "@/components/entity-components";

type Props = {
    searchParams: Promise<SearchParams>
}

export default async function page({ searchParams }: Props) {

    await requireAuth();
    const params = await workflowParamsLoaders(searchParams)


    await prefetchWorkflows(params);
    return (
        <WorkflowsContainer>
            <HydrateClient>
                <ErrorBoundary fallback={<ErrorView />}>
                    <Suspense fallback={<WorkflowsLoading />}>
                        <WorkflowsList />
                    </Suspense>
                </ErrorBoundary>
            </HydrateClient>
        </WorkflowsContainer>
    )
}
