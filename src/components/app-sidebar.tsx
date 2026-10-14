import { Link, useRouterState } from "@tanstack/react-router";
import {
  TrendingUp,
  Receipt,
  LayoutGrid,
  Settings,
  Database,
  ScrollText,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { title: "Visão Geral", url: "/", icon: TrendingUp },
  { title: "DRE Gerencial", url: "/dre", icon: Receipt },
  { title: "Apuração de Resultado", url: "/apuracao", icon: LayoutGrid },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Catálogo de Dados", url: "/catalogo", icon: Database },
  { title: "Logs de Sincronização", url: "/logs", icon: ScrollText },
];

export const LOGO_URL =
  "https://qvavpbhunmwfjrrgoifv.supabase.co/storage/v1/object/public/utils/logo_verde.png";

interface AppSidebarProps {
  email?: string | null;
  onLogout?: () => void;
}

/**
 * Rail lateral de ícones (56px) no estilo do Score Data Hub:
 * logo no topo, navegação com tooltip à direita, tema e sair no rodapé.
 */
export function AppSidebar({ email, onLogout }: AppSidebarProps) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();

  const isActive = (url: string) => {
    if (url === "/") return currentPath === "/" || currentPath === "";
    return currentPath.startsWith(url);
  };

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-14 flex-col items-center gap-1 border-r border-border bg-card py-4">
      {/* Logo */}
      <Link to="/" className="mb-3 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg" title="Grupo R3">
        <img src={LOGO_URL} alt="Grupo R3" className="h-9 w-9 object-contain" />
      </Link>

      {NAV_ITEMS.map(({ title, url, icon: Icon }) => {
        const active = isActive(url);
        return (
          <Tooltip key={url} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to={url}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {title}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Rodapé: tema + sair */}
      <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-border pt-4">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </TooltipContent>
        </Tooltip>

        {email && onLogout && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Sair ({email})
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
