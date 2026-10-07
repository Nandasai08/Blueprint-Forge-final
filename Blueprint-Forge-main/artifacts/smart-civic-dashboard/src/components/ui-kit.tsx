import type { ReactNode } from 'react';
import { AlertTriangle, LoaderCircle, Search } from 'lucide-react';

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-rise"><div>{eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p>}<h1 className="text-[29px] font-bold leading-tight">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>;
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`rounded-xl border border-card-border bg-card shadow-sm ${className}`}>{children}</section>; }
export function LoadingState({ label = 'Loading civic records' }: { label?: string }) {
  return <div className="space-y-4 animate-pulse" aria-label={label}><div className="h-8 w-52 rounded bg-muted"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((n)=><div key={n} className="h-28 rounded-xl bg-muted"/>)}</div><div className="h-64 rounded-xl bg-muted"/></div>;
}
export function ErrorState({ retry, message = 'We could not load this information.' }: { retry: () => void; message?: string }) {
  return <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-8 text-center"><AlertTriangle className="mx-auto mb-3 h-7 w-7 text-destructive"/><h3 className="font-semibold">Something needs attention</h3><p className="mt-1 text-sm text-muted-foreground">{message}</p><button onClick={retry} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button></div>;
}
export function EmptyState({ title = 'Nothing to show yet', detail = 'Records will appear here when they are available.' }: { title?: string; detail?: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-16 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><Search className="h-5 w-5"/></div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>;
}
export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; variant?: 'primary'|'outline'|'ghost'|'danger'; disabled?: boolean; type?: 'button'|'submit'; className?: string }) {
  const variants = { primary: 'bg-primary text-primary-foreground hover:opacity-90', outline: 'border border-border bg-card hover:bg-muted', ghost: 'hover:bg-muted', danger: 'bg-destructive text-destructive-foreground' };
  return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}>{disabled && type==='submit' ? <LoaderCircle className="h-4 w-4 animate-spin"/> : null}{children}</button>;
}
export function StatusPill({ value }: { value?: string | null }) {
  const status = (value || 'unknown').toLowerCase().replaceAll('_',' ');
  const color = /resolved|complete|good|active|collected|closed/.test(status) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : /critical|urgent|overdue|poor|high/.test(status) ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' : /progress|scheduled|medium|pending/.test(status) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-muted text-muted-foreground';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${color}`}>{status}</span>;
}
