import { requireAuth } from "@/lib/auth-utils";

interface PageProps {
    params: Promise<{
        credentialId: String
    }>
}

const Page = async ({ params }: PageProps) => {
    await requireAuth();
    const { credentialId } = await params;
    return (
        <p>Credential Id : {credentialId}</p>
    )
}

export default Page;