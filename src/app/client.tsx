"use client"

import { useTRPC } from "@/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query";

export const Client = () => {
    const trpc = useTRPC();
    const { data: users } = useSuspenseQuery(trpc.getUsers.queryOptions());

    return (
        <div className="flex items-center justify-center ">
            client component: {JSON.stringify(users)}
        </div>
    )
}