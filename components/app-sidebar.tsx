"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavDocuments } from "@/components/nav-documents";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  FileEditIcon,
  ShoppingCart01Icon,
  Invoice01Icon,
  PackageIcon,
  ReceiptIcon,
  Settings05Icon,
  HelpCircleIcon,
  ActivityIcon,
  CommandIcon,
  Alert01Icon,
} from "@/lib/icons";

const data = {
  user: {
    name: "P2P Admin",
    email: "admin@cognizant.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
    {
      title: "Requisitions",
      url: "/requisitions",
      icon: <HugeiconsIcon icon={FileEditIcon} strokeWidth={2} />,
    },
    {
      title: "Purchase Orders",
      url: "/purchase-orders",
      icon: <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} />,
    },
    {
      title: "Invoices",
      url: "/invoices",
      icon: <HugeiconsIcon icon={Invoice01Icon} strokeWidth={2} />,
    },
    {
      title: "Exceptions",
      url: "/exceptions",
      icon: <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} />,
    },
  ],
  documents: [
    {
      name: "Shipments",
      url: "/shipments",
      icon: <HugeiconsIcon icon={PackageIcon} strokeWidth={2} />,
    },
    {
      name: "Receipts",
      url: "/receipts",
      icon: <HugeiconsIcon icon={ReceiptIcon} strokeWidth={2} />,
    },
    {
      name: "Activity",
      url: "/activity",
      icon: <HugeiconsIcon icon={ActivityIcon} strokeWidth={2} />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />,
    },
    {
      title: "Help",
      url: "/help",
      icon: <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <HugeiconsIcon icon={CommandIcon} strokeWidth={2} className="size-5!" />
              <span className="text-base font-semibold">P2P Simulator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
