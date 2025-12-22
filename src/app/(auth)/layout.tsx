export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-ink selection:bg-accent-electric selection:text-ink">
            {children}
        </div>
    );
}
