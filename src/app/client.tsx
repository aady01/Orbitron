"use client"

import { useTRPC } from "@/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query";

export const Client = () => {
    const trpc = useTRPC();
    const { data: workflows } = useSuspenseQuery(trpc.workflows.getMany.queryOptions({
        page: 1,
        search: "",
    }));

    return (
        <div className="flex items-center justify-center ">
            client component: {JSON.stringify(workflows)}
        </div>
    )
}