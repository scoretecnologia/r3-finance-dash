import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/external";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: appUser } = await supabase
        .from("grupo_r3_users")
        .select("id, email")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (!appUser) {
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(appUser.email);
      setChecking(false);
    }

    verify();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/auth", replace: true });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  }

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex items-center gap-3 animate-slide-up">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        <AppSidebar email={email} onLogout={handleLogout} />

        <div className="ml-14 flex-1 min-w-0">
          {/* Header fixo no estilo do Data Hub */}
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur-md">
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-primary">Grupo R3</h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Análise Financeira
              </p>
            </div>
            <div className="flex items-center gap-3">
              {email && (
                <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <main className="p-6">
            <Outlet />
          </main>
        </div>
        <Toaster richColors position="top-right" />
      </div>
    </TooltipProvider>
  );
}
