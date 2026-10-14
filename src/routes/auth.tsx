import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/external";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_URL } from "@/components/app-sidebar";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

/** Tela de login no estilo do Score Data Hub (card com cabeçalho escuro e logo). */
function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Falha ao autenticar");

      // Verifica se o usuário é autorizado (existe em grupo_r3_users)
      const { data: appUser, error: userErr } = await supabase
        .from("grupo_r3_users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (userErr) throw userErr;
      if (!appUser) {
        await supabase.auth.signOut();
        throw new Error("Usuário não autorizado para acessar o sistema.");
      }

      toast.success("Bem-vindo ao Financeiro Grupo R3!");
      navigate({ to: "/", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao fazer login";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md overflow-hidden rounded-3xl border-0 bg-card shadow-2xl animate-slide-up">
        <div className="border-b border-white/5 bg-[#1A1A1A] p-10 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-white p-4 shadow-lg">
              <img src={LOGO_URL} alt="Grupo R3" className="h-full w-full object-contain" />
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Grupo R3</h1>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.4em] text-primary brightness-150">
            Análise Financeira
          </p>
        </div>

        <CardContent className="p-10 pt-12">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="email" className="ml-1 text-xs font-black uppercase tracking-widest text-muted-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-14 rounded-xl border-border bg-muted/40 px-5 text-base shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="ml-1 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-14 rounded-xl border-border bg-muted/40 px-5 pr-12 text-base shadow-sm focus:border-primary focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="h-14 w-full rounded-xl bg-[#1A1A1A] text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar Sistema"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border bg-muted/30 p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Desenvolvido por Score Tecnologia
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
