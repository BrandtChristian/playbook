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

const allNavItems = [
  { title: "Dashboard", href: "/", icon: Lightning, resendOnly: false },
  { title: "Flows", href: "/flows", icon: TreeStructure, resendOnly: true },
  { title: "Campaigns", href: "/campaigns", icon: PaperPlaneTilt, resendOnly: false },
  { title: "Emails", href: "/emails", icon: Envelope, resendOnly: false },
  { title: "Templates", href: "/templates", icon: Layout, resendOnly: false },
  { title: "Contacts", href: "/contacts", icon: Users, resendOnly: false },
  { title: "Segments", href: "/segments", icon: ListDashes, resendOnly: true },
  { title: "Data", href: "/data", icon: Database, resendOnly: true },
];

const settingsItems = [
  { title: "Account", href: "/account", icon: User },
  { title: "Settings", href: "/settings", icon: Gear },
];

export function AppSidebar({ emailProvider = "resend" }: { emailProvider?: "resend" | "agillic" }) {
  const pathname = usePathname();
  const navItems = emailProvider === "agillic"
    ? allNavItems.filter((item) => !item.resendOnly)
    : allNavItems;

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
