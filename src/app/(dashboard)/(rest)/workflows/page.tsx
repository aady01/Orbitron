import { requireAuth } from "@/lib/auth-utils"

export default async function page() {
    await requireAuth();
    return (
        <div>workflows</div>
    )
}
