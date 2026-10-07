import { useEffect } from 'react';
import { useGetDashboardStats, useApiHealthCheck, getGetDashboardStatsQueryKey, getApiHealthCheckQueryKey } from '@workspace/api-client-react';
import { ArrowUpRight, CheckCircle2, ClipboardList, Construction, MapPinned, ShieldAlert, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { Card, EmptyState, ErrorState, LoadingState, PageHeading, StatusPill } from '@/components/ui-kit';

function getDashboardErrorMessage(error: unknown): string {
  if (!error) return 'We could not load this information.';

  if (typeof error === 'object' && error !== null) {
    const err = error as { status?: number; data?: { error?: string; code?: string }; message?: string };
    const status = err.status;
    const backendMessage = err.data?.error || err.message || '';
    const code = err.data?.code || '';
    const lowerMessage = backendMessage.toLowerCase();

    // Missing table / RPC function / database setup
    if (
      code === 'PGRST205' ||
      code === 'PGRST202' ||
      lowerMessage.includes('schema cache') ||
      lowerMessage.includes('database setup') ||
      lowerMessage.includes('could not find the table') ||
      lowerMessage.includes('could not find the function') ||
      lowerMessage.includes('schema.sql')
    ) {
      return 'The database schema has not been initialized yet. Please apply schema.sql and seed.sql in the Supabase SQL Editor.';
    }

    // Authentication failure
    if (status === 401 || lowerMessage.includes('session') || lowerMessage.includes('sign in') || lowerMessage.includes('unauthorized')) {
      return 'Your authentication session has expired or is invalid. Please sign out and sign in again.';
    }

    // Authorization / RLS failure
    if (status === 403 || code === '42501' || lowerMessage.includes('permission') || lowerMessage.includes('role') || lowerMessage.includes('profile')) {
      return 'Access denied: your account does not have sufficient municipal authorization or an active profile. Contact your administrator.';
    }

    // Missing column / Database query failure
    if (lowerMessage.includes('column') || lowerMessage.includes('syntax') || lowerMessage.includes('query')) {
      return 'A database query error occurred while aggregating dashboard statistics. Please verify the database schema version.';
    }

    // Frontend parsing / invalid response failure
    if (lowerMessage.includes('json') || lowerMessage.includes('validation') || lowerMessage.includes('format') || lowerMessage.includes('parse')) {
      return 'Received an unexpected response structure from the municipal data service.';
    }

    // Network failure / API offline
    if (status === 0 || lowerMessage.includes('failed to fetch') || lowerMessage.includes('network') || lowerMessage.includes('econnrefused')) {
      return 'Unable to connect to the CivicDesk API server. Please ensure the backend service is running and reachable.';
    }

    if (backendMessage && !lowerMessage.includes('token') && !lowerMessage.includes('secret') && !lowerMessage.includes('key')) {
      return backendMessage;
    }
  }

  return 'Unable to load municipal dashboard statistics at this time.';
}

function BarList({ title, points, color = 'bg-primary' }: { title: string; points?: {name:string;count:number}[]; color?: string }) {
  const max = Math.max(1, ...(points || []).map(point => point.count));
  return <Card className="p-5"><div className="mb-5 flex items-center justify-between"><h3 className="font-bold">{title}</h3><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Current period</span></div>{points?.length ? <div className="space-y-4">{points.slice(0,6).map(point=><div key={point.name}><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">{point.name}</span><span className="font-semibold tabular-nums">{point.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{width:`${Math.max(5,point.count/max*100)}%`}}/></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No breakdown data available.</p>}</Card>;
}
export default function DashboardPage() {
  const query = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const health = useApiHealthCheck({ query: { queryKey: getApiHealthCheckQueryKey(), staleTime: 60_000 } });

  useEffect(() => {
    if (query.isError && query.error) {
      const err = query.error as { status?: number; data?: unknown; message?: string; url?: string };
      console.error('[CivicDesk Dashboard Technical Error]', {
        timestamp: new Date().toISOString(),
        status: err.status,
        data: err.data,
        message: err.message,
        url: err.url,
        rawError: query.error,
      });
    }
  }, [query.isError, query.error]);

  if (query.isLoading) return <LoadingState/>;
  if (query.isError || !query.data) {
    const message = getDashboardErrorMessage(query.error);
    return <ErrorState retry={() => query.refetch()} message={message}/>;
  }
  const stats = query.data;
  const serviceStatus=health.isLoading?'checking':health.data?.database??(health.isError?'unavailable':'unknown');
  const metrics = [
    { label:'Open complaints', value:stats.pending_complaints, delta:'Awaiting review', icon:ClipboardList, tint:'bg-[#e8f0f6] text-[#2f6082] dark:bg-[#244157] dark:text-[#b7d3e5]' },
    { label:'In progress', value:stats.in_progress_complaints, delta:'Teams assigned', icon:Construction, tint:'bg-[#f7f0df] text-[#97712f] dark:bg-[#463d29] dark:text-[#e6ca8b]' },
    { label:'Resolved', value:stats.resolved_complaints, delta:`${stats.total_complaints} total reports`, icon:CheckCircle2, tint:'bg-[#e5f2eb] text-[#327559] dark:bg-[#243d32] dark:text-[#a9d3bb]' },
    { label:'Critical issues', value:stats.critical_issue_count, delta:'Requires attention', icon:ShieldAlert, tint:'bg-[#f8e9e7] text-[#a7524e] dark:bg-[#492e2d] dark:text-[#efb7b1]' },
  ];
  return <div>
    <PageHeading eyebrow="Operations overview" title="Good morning, team" description="A live view of service requests and city-wide operational priorities." action={<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"><span className={`h-2 w-2 rounded-full ${health.data?.database === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}/><span className="text-muted-foreground">Data services</span><span className="font-semibold capitalize">{serviceStatus}</span></div>}/>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((item,i)=>{const Icon=item.icon; return <Card key={item.label} className={`animate-rise p-5 delay-${i+1}`}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-muted-foreground">{item.label}</p><p className="mt-3 font-mono text-[30px] font-bold tracking-tight">{item.value ?? 0}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${item.tint}`}><Icon className="h-5 w-5"/></span></div><p className="mt-2 text-[11px] text-muted-foreground">{item.delta}</p></Card>})}</div>
    <div className="mb-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="font-bold">Recent complaints</h3><p className="mt-1 text-xs text-muted-foreground">Latest community reports</p></div><Link href="/complaints" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">All complaints<ArrowUpRight className="h-3.5 w-3.5"/></Link></div>
      {stats.recent_complaints?.length ? <div className="divide-y divide-border">{stats.recent_complaints.slice(0,5).map((record,index)=><Link key={record.id} href={`/complaints/${record.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/50" data-testid={`link-recent-complaint-${record.id}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><ClipboardList className="h-4 w-4"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{record.title || record.category || 'Community report'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{record.area_name || record.location || 'Location not specified'} · {record.complaint_number || record.id.slice(0,8)}</p></div><StatusPill value={record.status}/></Link>)}</div> : <div className="p-5"><EmptyState title="No recent complaints" detail="There are no complaint records to display."/></div>}</Card>
      <Card className="relative overflow-hidden bg-[#eaf3ef] p-6 dark:bg-[#20382f]"><div className="absolute -right-10 -top-12 h-48 w-48 rounded-full border border-[#aacabe]/50"/><div className="relative"><span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#d3e7dd] text-[#356d58] dark:bg-[#315843] dark:text-[#c0e0cd]"><Sparkles className="h-5 w-5"/></span><p className="text-xs font-bold uppercase tracking-[.14em] text-[#41745e] dark:text-[#9ac7ad]">Service pulse</p><h3 className="mt-2 max-w-[270px] text-2xl font-bold">A shared view helps every team move with confidence.</h3><p className="mt-3 max-w-sm text-sm leading-6 text-[#526f61] dark:text-[#b0c8bb]">Use area performance and operational reports to spot patterns early and direct resources where they matter most.</p><Link href="/areas" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#32694f] dark:text-[#b7dbc4]">Explore area performance<ArrowUpRight className="h-4 w-4"/></Link></div></Card>
    </div>
    <div className="grid gap-5 lg:grid-cols-3"><BarList title="Complaints by category" points={stats.complaints_by_category}/><BarList title="Complaints by status" points={stats.complaints_by_status} color="bg-[#4e9b7d]"/><BarList title="Monthly trend" points={stats.monthly_trends} color="bg-[#65a5b8]"/></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><BarList title="Priority distribution" points={stats.priority_distribution} color="bg-[#d39352]"/><Card className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-bold">City service coverage</h3><MapPinned className="h-4 w-4 text-primary"/></div><div className="grid grid-cols-3 gap-3">{[['Infrastructure',stats.infrastructure_issues],['Sanitation',stats.sanitation_issues],['Maintenance',stats.active_maintenance]].map(([label,value])=><div key={label} className="rounded-lg bg-muted/70 p-4"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-2 font-mono text-2xl font-bold">{value}</p></div>)}</div><p className="mt-4 text-xs text-muted-foreground">Counts reflect current active civic records.</p></Card></div>
  </div>;
}
