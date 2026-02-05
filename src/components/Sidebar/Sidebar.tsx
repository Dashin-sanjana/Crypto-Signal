import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    LayoutDashboard,
    TrendingUp,
    Wallet,
    Newspaper,
    Settings,
    ChevronLeft,
    ChevronRight,
    Activity,
    Bot,
    Zap
} from "lucide-react";

interface SidebarProps {
    activeSignals?: number;
    isConnected?: boolean;
}

interface NavItem {
    icon: React.ElementType;
    label: string;
    id: string;
    badge?: number;
}

const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
    { icon: TrendingUp, label: "Signals", id: "signals" },
    { icon: Wallet, label: "Positions", id: "positions" },
    { icon: Newspaper, label: "News", id: "news" },
    { icon: Bot, label: "Bot Control", id: "bot" },
    { icon: Settings, label: "Settings", id: "settings" },
];

const Sidebar: React.FC<SidebarProps> = ({ activeSignals = 0, isConnected = true }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [activeItem, setActiveItem] = useState("dashboard");

    return (
        <aside
            className={cn(
                "flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
                collapsed ? "w-[68px]" : "w-[240px]"
            )}
        >
            {/* Logo */}
            <div className="flex h-16 items-center justify-between border-b px-4">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <Zap className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">CryptoTrader</span>
                    </div>
                )}
                {collapsed && (
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                )}
            </div>

            {/* Status */}
            <div className={cn("border-b p-4", collapsed && "flex justify-center")}>
                {!collapsed ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                            )} />
                            <span className="text-xs text-muted-foreground">
                                {isConnected ? "Connected" : "Disconnected"}
                            </span>
                        </div>
                        {activeSignals > 0 && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                {activeSignals} Active
                            </Badge>
                        )}
                    </div>
                ) : (
                    <div className={cn(
                        "h-3 w-3 rounded-full",
                        isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                    )} />
                )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 py-4">
                <nav className="flex flex-col gap-1 px-2">
                    {navItems.map((item) => (
                        <Button
                            key={item.id}
                            variant={activeItem === item.id ? "secondary" : "ghost"}
                            className={cn(
                                "justify-start gap-3 h-11",
                                collapsed && "justify-center px-2",
                                activeItem === item.id && "bg-primary/10 text-primary border border-primary/20"
                            )}
                            onClick={() => setActiveItem(item.id)}
                        >
                            <item.icon className={cn("h-5 w-5", collapsed && "h-5 w-5")} />
                            {!collapsed && <span>{item.label}</span>}
                            {!collapsed && item.id === "signals" && activeSignals > 0 && (
                                <Badge variant="secondary" className="ml-auto">
                                    {activeSignals}
                                </Badge>
                            )}
                        </Button>
                    ))}
                </nav>
            </ScrollArea>

            <Separator />

            {/* Collapse Toggle */}
            <div className="p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("w-full justify-center", !collapsed && "justify-start gap-2")}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4" />
                            <span>Collapse</span>
                        </>
                    )}
                </Button>
            </div>
        </aside>
    );
};

export default Sidebar;
