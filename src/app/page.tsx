"use client"
import { Button } from "@/components/ui/button"
import { useTRPC } from "@/trpc/client"
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Page() {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.getWorkflow.queryOptions());
  const create = useMutation(trpc.createWorkflow.mutationOptions({
    onSuccess: () => {
      toast.success("Job Queued")
    },
    onError: (error) => {
      toast.error("Failed to create workflow: " + error.message)
    }
  }))

  if (isLoading) {
    return (
      <div className="min-h-screen min-w-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen min-w-screen flex items-center justify-center">
        <div>Error: {error.message}</div>
      </div>
    )
  }




  return (
    <div className="min-h-screen min-w-screen flex items-center justify-center flex-col gap-y-6">
      <div>
        {JSON.stringify(data, null, 2)}
      </div>
      <Button disabled={create.isPending} onClick={() => { create.mutate() }}>
        create workflow
      </Button>
    </div>
  )
}