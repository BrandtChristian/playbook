"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EnvelopeSimple,
  Envelope,
  Users,
  PaperPlaneTilt,
  Gear,
  ListDashes,
  Lightning,
  Database,
  User,
  TreeStructure,
  Layout,
} from "@phosphor-icons/react";
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
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";

const navItems = [
  { title: "Dashboard", href: "/", icon: Lightning },
  { title: "Flows", href: "/flows", icon: TreeStructure },
  { title: "Campaigns", href: "/campaigns", icon: PaperPlaneTilt },
  { title: "Emails", href: "/emails", icon: Envelope },
  { title: "Templates", href: "/templates", icon: Layout },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Segments", href: "/segments", icon: ListDashes },
  { title: "Data", href: "/data", icon: Database },
];

const settingsItems = [
  { title: "Account", href: "/account", icon: User },
  { title: "Settings", href: "/settings", icon: Gear },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground font-bold text-sm">
            F
          </div>
          <span className="font-semibold text-lg">Forge</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon weight={pathname === item.href ? "fill" : "regular"} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon weight={pathname === item.href ? "fill" : "regular"} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
