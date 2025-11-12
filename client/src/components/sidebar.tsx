import { Link, useLocation } from "wouter";
import { Home, Link2, FileText, Sparkles, LogOut, Sun, Moon, X, Calendar as CalendarIcon, Save, BarChart3, Instagram, PinIcon as Pinterest, ShoppingBag, ShoppingCart, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/54001569-a0f4-4317-b11e-f801dff83e13_1762315521648.png";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  const handleLogout = async () => {
    try {
      // Call backend to clear cookies
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      // Even if the backend call fails, still clear local storage and redirect
      console.error("Logout error:", error);
    }
    
    // Clear local storage
    localStorage.removeItem("token");
    
    toast({
      title: "Logged out",
      description: "You've been logged out successfully",
    });
    
    setLocation("/login");
  };

  const navItems = [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/ai-studio", icon: Sparkles, label: "Create" },
    { href: "/drafts", icon: Save, label: "Drafts" },
    { href: "/calendar", icon: CalendarIcon, label: "Calendar" },
    { href: "/connections", icon: Link2, label: "Connections" },
    { href: "/posts", icon: FileText, label: "Posts" },
    ...(import.meta.env.VITE_METRICS_ENGAGEMENT === "1" 
      ? [{ href: "/analytics/twitter", icon: BarChart3, label: "Twitter Analytics" }] 
      : []),
    ...(import.meta.env.VITE_ANALYTICS_INSTAGRAM === "1"
      ? [{ href: "/analytics/instagram", icon: Instagram, label: "Instagram Analytics" }]
      : []),
    ...(import.meta.env.VITE_ANALYTICS_PINTEREST === "1"
      ? [{ href: "/analytics/pinterest", icon: Pinterest, label: "Pinterest Analytics" }]
      : []),
    ...(import.meta.env.VITE_ANALYTICS_SHOPIFY === "1"
      ? [{ href: "/analytics/shopify", icon: ShoppingBag, label: "Shopify Analytics" }]
      : []),
    ...(import.meta.env.VITE_ANALYTICS_ETSY === "1"
      ? [{ href: "/analytics/etsy", icon: ShoppingCart, label: "Etsy Analytics" }]
      : []),
    ...(import.meta.env.VITE_ANALYTICS_SQUARESPACE === "1"
      ? [{ href: "/analytics/squarespace", icon: Square, label: "Squarespace Analytics" }]
      : []),
  ];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && onClose && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed lg:sticky top-0 h-screen w-64 border-r border-border bg-sidebar flex flex-col z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center h-full">
            <img 
              src={logoImage} 
              alt="PicScripterAI" 
              loading="lazy"
              className="
                px-3
                h-auto
                w-[150px]
                sm:w-[200px]
                lg:w-[260px]
                max-w-full
              "
              data-testid="img-logo-sidebar"
            />
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={handleNavClick}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-5 w-5" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-5 w-5" />
                <span>Dark Mode</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
