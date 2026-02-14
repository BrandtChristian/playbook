export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      {/* Left branding panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-primary-foreground text-primary font-bold text-lg">
            F
          </div>
          <span className="text-2xl font-semibold">Forge</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Email marketing,<br />forged for growth.
          </h1>
          <p className="text-primary-foreground/70 text-lg max-w-md">
            AI-powered playbooks, beautiful templates, and smart segmentation.
            Start sending in minutes, not days.
          </p>
        </div>
        <p className="text-primary-foreground/50 text-sm">
          Forge
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-muted p-4">
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          {/* Mobile-only logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground font-bold text-lg">
              F
            </div>
            <span className="text-2xl font-semibold">Forge</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
