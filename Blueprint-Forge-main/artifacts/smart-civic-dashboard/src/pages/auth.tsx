import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui-kit';

type Mode = 'login'|'register'|'forgot'|'reset';
const copy: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  login: { title: 'Welcome back', subtitle: 'Sign in to your municipal workspace.', submit: 'Sign in' },
  register: { title: 'Create your account', subtitle: 'Request access to your city operations workspace.', submit: 'Create account' },
  forgot: { title: 'Reset your password', subtitle: 'We will send a secure reset link to your email.', submit: 'Send reset link' },
  reset: { title: 'Choose a new password', subtitle: 'Use a strong password you have not used before.', submit: 'Update password' },
};
export function AuthPage({ mode }: { mode: Mode }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    if (!supabase) { setError('Authentication is not configured. Contact your system administrator.'); setBusy(false); return; }
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        navigate('/dashboard');
      } else if (mode === 'register') {
        const { error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, department } } });
        if (authError) throw authError;
        setMessage('Your account request has been received. Check your email for the next step.');
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (authError) throw authError;
        setMessage('If an account exists for that address, a reset link is on its way.');
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage('Password updated. You can now continue to your workspace.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not complete that request.'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-[1.03fr_.97fr]">
    <section className="relative hidden overflow-hidden bg-[#183b53] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-40 -top-36 h-[540px] w-[540px] rounded-full border border-white/10"/><div className="absolute -right-20 -top-16 h-[300px] w-[300px] rounded-full border border-white/10"/><div className="absolute bottom-24 right-16 h-60 w-60 rounded-full bg-[#2e8b72]/25 blur-3xl"/>
      <div className="relative flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#3f9b7c]"><Building2 className="h-6 w-6"/></div><div><p className="font-bold tracking-tight">CivicDesk</p><p className="text-[10px] uppercase tracking-[.16em] text-white/55">Municipal operations</p></div></div>
      <div className="relative max-w-xl pb-10"><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#9ed9c1]">A clearer view of city services</p><h1 className="text-5xl font-bold leading-[1.08]">Good work starts with a shared picture.</h1><p className="mt-6 max-w-md text-base leading-7 text-white/70">Trusted tools for the teams who keep streets, neighborhoods and essential services moving.</p><div className="mt-10 flex items-center gap-3 border-t border-white/15 pt-6 text-sm text-white/75"><ShieldCheck className="h-5 w-5 text-[#9ed9c1]"/>Protected access for authorized city teams</div></div>
      <p className="relative text-[11px] text-white/40">City operations workspace · secure access</p>
    </section>
    <section className="flex min-h-[100dvh] items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-[430px] animate-rise">
        <Link href="/login" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground lg:hidden"><Building2 className="h-4 w-4 text-primary"/>CivicDesk</Link>
        {mode !== 'login' && <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Back to sign in</Link>}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">CivicDesk access</p><h2 className="text-3xl font-bold">{copy[mode].title}</h2><p className="mt-2 text-sm text-muted-foreground">{copy[mode].subtitle}</p>
        {message ? <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="mb-2 h-5 w-5"/>{message}{mode === 'reset' && <button onClick={() => navigate('/login')} className="mt-4 block font-semibold underline">Return to sign in</button>}</div> :
          <form className="mt-8 space-y-4" onSubmit={submit}>
            {mode === 'register' && <><label className="block text-sm font-semibold">Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-lg border border-input bg-card px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"/></label><label className="block text-sm font-semibold">Department<input required value={department} onChange={e=>setDepartment(e.target.value)} className="mt-2 w-full rounded-lg border border-input bg-card px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"/></label></>}
            {mode !== 'reset' && <label className="block text-sm font-semibold">Work email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@city.gov" className="mt-2 w-full rounded-lg border border-input bg-card px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"/></label>}
            {mode !== 'forgot' && <label className="block text-sm font-semibold">{mode === 'reset' ? 'New password' : 'Password'}<input required minLength={8} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" className="mt-2 w-full rounded-lg border border-input bg-card px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"/></label>}
            {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="mt-2 w-full py-3">{busy ? 'Please wait…' : copy[mode].submit}</Button>
            {mode === 'login' && <Link href="/forgot-password" className="block pt-1 text-center text-xs font-semibold text-primary hover:underline">Forgot password?</Link>}
          </form>}
        {mode === 'login' && <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">Need an account? <Link href="/register" className="font-semibold text-primary hover:underline">Request access</Link></p>}
        <p className="mt-8 text-center text-[11px] leading-5 text-muted-foreground">Access is limited to authorized municipal personnel.<br/>Your session is encrypted and protected.</p>
      </div>
    </section>
  </div>;
}
