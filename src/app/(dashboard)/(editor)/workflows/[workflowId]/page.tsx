import { requireAuth } from "@/lib/auth-utils";

interface PageProps {
    params: Promise<{
        workflowId: String
    }>
}

const Page = async ({ params }: PageProps) => {
    await requireAuth();
    const { workflowId } = await params;
    return (
        <p>Workflow Id : {workflowId}</p>
    )
}

export default Page;