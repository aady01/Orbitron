import AppHead from "@/components/app-header";

export default function layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <AppHead />
            <main className="flex-1">{children}</main>
        </>
    )
}
