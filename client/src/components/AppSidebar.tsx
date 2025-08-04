import { Calculator, BarChart3, ArrowRightLeft, PieChart, History, Target, Upload, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Min Månadsbudget", url: "/inkomster", icon: Calculator },
  { title: "Sammanställning", url: "/sammanstallning", icon: BarChart3 },
  { title: "Överföring", url: "/overforing", icon: ArrowRightLeft },
  { title: "Egen Budget", url: "/egen-budget", icon: PieChart },
  { title: "Historia", url: "/historia", icon: History },
  { title: "Sparmål", url: "/sparmal", icon: Target },
  { title: "Ladda upp CSV-filer", url: "/transaktioner", icon: Upload },
  { title: "Inställningar", url: "/installningar", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Huvudmeny</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link 
                      href={item.url} 
                      className={isActive(item.url) ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50"}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}