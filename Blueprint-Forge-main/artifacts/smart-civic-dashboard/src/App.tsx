import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/components/auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { AuthPage } from '@/pages/auth';
import DashboardPage from '@/pages/dashboard';
import { ResourcePage } from '@/pages/resources';
import { NotificationsPage, ReportsPage, SettingsPage } from '@/pages/workspace';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 20_000 },
    mutations: { retry: 0 },
  },
});

function Secure({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  if (!ready) return <div className="min-h-[100dvh] bg-background p-8"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-12 w-56 rounded-lg bg-muted"/><div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map(item=><div key={item} className="h-28 rounded-xl bg-muted"/>)}<div className="col-span-full h-72 rounded-xl bg-muted"/></div></div></div>;
  if (!session) return <Redirect to="/login"/>;
  return <AppShell>{children}</AppShell>;
}
function PublicAuth({ mode }: { mode: 'login'|'register'|'forgot'|'reset' }) {
  const { session, ready } = useAuth();
  if (ready && session && mode !== 'reset') return <Redirect to="/dashboard"/>;
  return <AuthPage mode={mode}/>;
}
function GuardedDashboard() { return <Secure><DashboardPage/></Secure>; }
function GuardedComplaints() { return <Secure><ResourcePage resource="complaints"/></Secure>; }
function GuardedComplaintDetail() { return <Secure><ResourcePage resource="complaints"/></Secure>; }
function GuardedInfrastructure() { return <Secure><ResourcePage resource="infrastructure"/></Secure>; }
function GuardedInfrastructureDetail() { return <Secure><ResourcePage resource="infrastructure"/></Secure>; }
function GuardedSanitation() { return <Secure><ResourcePage resource="sanitation"/></Secure>; }
function GuardedSanitationDetail() { return <Secure><ResourcePage resource="sanitation"/></Secure>; }
function GuardedMaintenance() { return <Secure><ResourcePage resource="maintenance"/></Secure>; }
function GuardedMaintenanceDetail() { return <Secure><ResourcePage resource="maintenance"/></Secure>; }
function GuardedAreas() { return <Secure><ResourcePage resource="areas"/></Secure>; }
function GuardedAreaDetail() { return <Secure><ResourcePage resource="areas"/></Secure>; }
function GuardedReports() { return <Secure><ReportsPage/></Secure>; }
function GuardedNotifications() { return <Secure><NotificationsPage/></Secure>; }
function GuardedSettings() { return <Secure><SettingsPage/></Secure>; }

function Router() {
  return <Switch>
    <Route path="/" component={()=><Redirect to="/dashboard"/>}/>
    <Route path="/login" component={()=><PublicAuth mode="login"/>}/>
    <Route path="/register" component={()=><PublicAuth mode="register"/>}/>
    <Route path="/forgot-password" component={()=><PublicAuth mode="forgot"/>}/>
    <Route path="/reset-password" component={()=><PublicAuth mode="reset"/>}/>
    <Route path="/dashboard" component={GuardedDashboard}/>
    <Route path="/complaints" component={GuardedComplaints}/>
    <Route path="/complaints/:id" component={GuardedComplaintDetail}/>
    <Route path="/infrastructure" component={GuardedInfrastructure}/>
    <Route path="/infrastructure/:id" component={GuardedInfrastructureDetail}/>
    <Route path="/sanitation" component={GuardedSanitation}/>
    <Route path="/sanitation/:id" component={GuardedSanitationDetail}/>
    <Route path="/maintenance" component={GuardedMaintenance}/>
    <Route path="/maintenance/:id" component={GuardedMaintenanceDetail}/>
    <Route path="/areas" component={GuardedAreas}/>
    <Route path="/areas/:id" component={GuardedAreaDetail}/>
    <Route path="/reports" component={GuardedReports}/>
    <Route path="/notifications" component={GuardedNotifications}/>
    <Route path="/settings" component={GuardedSettings}/>
    <Route component={NotFound}/>
  </Switch>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <RoutedErrorBoundary><Router/></RoutedErrorBoundary>
          </WouterRouter>
          <Toaster/>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>;
}

export default App;
