import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  LayoutDashboard,
  Search,
  Users,
  ClipboardCheck,
  FileSearch,
  MessageSquare,
  Gavel,
  Settings,
  LogOut,
  Brain,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const nav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Sourcing", url: "/sourcing", icon: Search },
  { title: "Founder Workspace", url: "/founders", icon: Users },
  { title: "Founder Score", url: "/founder-score", icon: Activity },
  { title: "Screening", url: "/screening", icon: ClipboardCheck },
  { title: "Diligence", url: "/diligence", icon: FileSearch },
  { title: "Interview Scores", url: "/interview", icon: MessageSquare },
  { title: "Investment Committee", url: "/committee", icon: Gavel },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Brain className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                Get Funded
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                Sequoia · Alpha workspace
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary"
                  >
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <CurrentUserMenuItem collapsed={collapsed} />
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log out">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Log out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function CurrentUserMenuItem({ collapsed }: { collapsed: boolean }) {
  const { displayName, initials, email } = useCurrentUser();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={displayName} className="gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium">{displayName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{email || "Signed in"}</div>
          </div>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
