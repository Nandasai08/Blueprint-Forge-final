import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, Bell, Building2, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Menu, Moon, Search, Settings, Sun, Trees, Wrench, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';
import { useGetCurrentProfile, useGetNotifications, useSearchCivicData } from '@workspace/api-client-react';
import { getGetCurrentProfileQueryKey, getGetNotificationsQueryKey, getSearchCivicDataQueryKey } from '@workspace/api-client-react';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Complaints', href: '/complaints', icon: ClipboardList },
  { label: 'Infrastructure', href: '/infrastructure', icon: Building2 },
  { label: 'Sanitation', href: '/sanitation', icon: Trees },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench },
  { label: 'Areas', href: '/areas', icon: Activity },
];
const workItems = [{ label: 'Reports', href: '/reports', icon: Activity }, { label: 'Notifications', href: '/notifications', icon: Bell }, { label: 'Settings', href: '/settings', icon: Settings }];
type SearchResult = { id:string; title?:string|null; name?:string|null; category?:string|null; area_name?:string|null; location?:string|null };

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const profile = useGetCurrentProfile({ query: { queryKey: getGetCurrentProfileQueryKey() } });
  const alerts = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey() } });
  const searchParams = { q: search.trim() || ' ' };
  const searchResults = useSearchCivicData(searchParams, { query: { queryKey: getSearchCivicDataQueryKey(searchParams), enabled: search.trim().length >= 2 } });
  const unread = alerts.data?.filter(n => !n.is_read).length || 0;
  const displayName = profile.data?.full_name || profile.data?.email || 'City team member';
  const navLinks = (items: typeof navItems) => items.map(item => {
    const Icon = item.icon;
    const active = location === item.href || (item.href !== '/dashboard' && location.startsWith(`${item.href}/`));
    return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} data-testid={`link-nav-${item.label.toLowerCase()}`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-white'}`}><Icon className="h-[17px] w-[17px]"/>{item.label}{item.href === '/notifications' && unread > 0 && <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-[10px] text-white">{unread}</span>}</Link>;
  });
  return <div className="min-h-[100dvh] bg-background text-foreground">
    {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-white"><Building2 className="h-5 w-5"/></div><div><p className="font-bold leading-tight tracking-tight">CivicDesk</p><p className="mt-0.5 text-[10px] uppercase tracking-[.15em] text-sidebar-foreground/50">Municipal operations</p></div><button className="ml-auto rounded-md p-1 text-sidebar-foreground/60 md:hidden" onClick={() => setOpen(false)}><X className="h-4 w-4"/></button></div>
      <div className="px-4 pt-6"><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-sidebar-foreground/40">Operations</p><nav className="space-y-1">{navLinks(navItems)}</nav></div>
      <div className="px-4 pt-7"><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-sidebar-foreground/40">Workspace</p><nav className="space-y-1">{navLinks(workItems)}</nav></div>
      <div className="mt-auto border-t border-sidebar-border p-4"><div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/60 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d8e9e2] text-xs font-bold text-[#234a3d]">{displayName.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{displayName}</p><p className="truncate text-[10px] text-sidebar-foreground/55">{profile.data?.department || profile.data?.role || 'Authorized staff'}</p></div><button title="Sign out" onClick={() => signOut()} className="rounded-md p-1.5 text-sidebar-foreground/55 hover:bg-sidebar-border hover:text-white"><LogOut className="h-4 w-4"/></button></div></div>
    </aside>
    <div className="md:pl-[252px]">
      <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-7">
        <button onClick={() => setOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 hover:bg-muted md:hidden"><Menu className="h-5 w-5"/></button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span>City services</span><span className="text-border">/</span><span className="font-semibold capitalize text-foreground">{location.split('/')[1]?.replaceAll('-',' ') || 'Dashboard'}</span></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden lg:block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search civic records" aria-label="Search civic records" data-testid="input-global-search" className="h-9 w-56 rounded-lg border border-border bg-card pl-9 pr-3 text-xs outline-none transition-all placeholder:text-muted-foreground/70 focus:w-72 focus:ring-2 focus:ring-ring"/>{search.trim().length >= 2 && <div className="absolute right-0 top-11 z-30 w-[340px] rounded-xl border border-border bg-card p-2 shadow-lg">{searchResults.isLoading ? <p className="p-3 text-xs text-muted-foreground">Searching civic records…</p> : searchResults.isError ? <p className="p-3 text-xs text-destructive">Search is unavailable.</p> : searchResults.data ? Object.entries(searchResults.data as unknown as Record<string,SearchResult[]>).flatMap(([resource,records])=>records.map(record=><Link key={`${resource}-${record.id}`} href={`/${resource}/${record.id}`} onClick={()=>setSearch('')} className="block rounded-lg px-3 py-2 hover:bg-muted"><p className="truncate text-xs font-semibold">{record.title || record.name || record.category || 'Civic record'}</p><p className="mt-1 text-[10px] text-muted-foreground">{resource} · {record.area_name || record.location || record.id}</p></Link>)).length ? Object.entries(searchResults.data as unknown as Record<string,SearchResult[]>).flatMap(([resource,records])=>records.map(record=><Link key={`${resource}-${record.id}`} href={`/${resource}/${record.id}`} onClick={()=>setSearch('')} className="block rounded-lg px-3 py-2 hover:bg-muted"><p className="truncate text-xs font-semibold">{record.title || record.name || record.category || 'Civic record'}</p><p className="mt-1 text-[10px] text-muted-foreground">{resource} · {record.area_name || record.location || record.id}</p></Link>)) : <p className="p-3 text-xs text-muted-foreground">No matching records found.</p> : null}</div>}</div>
          <button onClick={toggle} aria-label="Toggle color theme" data-testid="button-theme-toggle" className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted">{theme === 'light' ? <Moon className="h-4 w-4"/> : <Sun className="h-4 w-4"/>}</button>
          <Link href="/notifications" aria-label="View notifications" className="relative rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><Bell className="h-4 w-4"/>{unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">{unread}</span>}</Link>
          <div className="ml-1 hidden items-center gap-2 border-l border-border pl-3 sm:flex"><span className="max-w-[155px] truncate text-xs font-semibold">{displayName}</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground"/></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-7 lg:px-9 lg:py-8">{children}</main>
      <footer className="mx-auto flex max-w-[1600px] items-center justify-between border-t border-border px-4 py-5 text-[10px] text-muted-foreground sm:px-7 lg:px-9"><span>City operations workspace</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Secure session</span></footer>
    </div>
  </div>;
}
