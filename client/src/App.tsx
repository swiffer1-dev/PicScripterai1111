import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Connections from "@/pages/connections";
import Posts from "@/pages/posts";
import AIStudio from "@/pages/ai-studio";
import Calendar from "@/pages/calendar";
import Drafts from "@/pages/drafts";
import TwitterAnalytics from "@/pages/analytics/Twitter";
import InstagramAnalytics from "@/pages/analytics/Instagram";
import PinterestAnalytics from "@/pages/analytics/Pinterest";
import ShopifyAnalytics from "@/pages/analytics/Shopify";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const token = localStorage.getItem("token");
  
  if (!token) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/connections">
        {() => <ProtectedRoute component={Connections} />}
      </Route>
      <Route path="/posts">
        {() => <ProtectedRoute component={Posts} />}
      </Route>
      <Route path="/ai-studio">
        {() => <ProtectedRoute component={AIStudio} />}
      </Route>
      <Route path="/calendar">
        {() => <ProtectedRoute component={Calendar} />}
      </Route>
      <Route path="/drafts">
        {() => <ProtectedRoute component={Drafts} />}
      </Route>
      {import.meta.env.VITE_METRICS_ENGAGEMENT === "1" && (
        <Route path="/analytics/twitter">
          {() => <ProtectedRoute component={TwitterAnalytics} />}
        </Route>
      )}
      {import.meta.env.VITE_FEATURE_PER_PLATFORM_ANALYTICS === "true" && (
        <>
          <Route path="/analytics/instagram">
            {() => <ProtectedRoute component={InstagramAnalytics} />}
          </Route>
          <Route path="/analytics/pinterest">
            {() => <ProtectedRoute component={PinterestAnalytics} />}
          </Route>
          <Route path="/analytics/shopify">
            {() => <ProtectedRoute component={ShopifyAnalytics} />}
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Make theme toggle available globally
  (window as any).toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
