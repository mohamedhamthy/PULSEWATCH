import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
} from 'recharts';
import clsx from 'clsx';
import {
  Activity,
  ArrowRight,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  Command,
  ExternalLink,
  Gauge,
  Globe,
  LayoutDashboard,
  LogOut,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  createdAt: string;
};

type Monitor = {
  id: string;
  userId: string;
  name: string;
  url: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN' | 'PAUSED' | 'PENDING';
  lastCheck: string | null;
  responseTimeMs: number;
  statusCode: number | null;
  intervalMs: number;
  timeoutMs: number;
  expectedStatusCodes: number[];
  tags: string[];
  alertPreferences: string[];
  paused: boolean;
  createdAt: string;
  updatedAt: string;
};

type CheckEntry = {
  id: string;
  monitorId: string;
  monitorName?: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN' | 'PAUSED' | 'PENDING';
  responseTimeMs: number;
  statusCode: number | null;
  checkedAt: string;
  error?: string | null;
};

type DashboardOverview = {
  totalMonitors: number;
  healthyMonitors: number;
  downMonitors: number;
  openIncidents: number;
  availability: number;
  averageResponseTime: number;
  recentChecks: CheckEntry[];
  incidentSummary: Array<{ id: string; title: string; severity: string; status: string; monitor: string; createdAt: string }>;
  availabilityTrend: Array<{ date: string; uptime: number }>;
  responseTimeTrend: Array<{ date: string; responseTime: number }>;
  monitors: Monitor[];
};

const authSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must include at least one number.'),
});

const resetSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must include at least one number.'),
});

const monitorSchema = z.object({
  name: z.string().min(2, 'Monitor name is required.'),
  url: z.string().url('Enter a valid HTTP/HTTPS URL.'),
  intervalMs: z.coerce.number().min(30000, 'Check interval must be at least 30 seconds.'),
  timeoutMs: z.coerce.number().min(3000, 'Timeout must be at least 3 seconds.'),
  expectedStatusCodes: z.string().default('200,201,204'),
  tags: z.string().optional(),
  alertPreferences: z.string().default('email'),
});

function formatDate(input: string | null | undefined) {
  if (!input) return 'Never';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(input));
}

function formatMs(value?: number | null) {
  if (!value || value <= 0) return '—';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

function getStatusClass(status: string) {
  switch (status) {
    case 'UP':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30';
    case 'DOWN':
      return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30';
    case 'PAUSED':
      return 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/30';
    case 'PENDING':
      return 'bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/30';
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', getStatusClass(status))}>
      {status}
    </span>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DashboardPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MonitorsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MonitorFormPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MonitorDetailPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitors/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MonitorFormPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string }) => Promise<{ verificationToken?: string }>; 
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const data = await api.get<{ user: User }>('/auth/me');
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (payload: { email: string; password: string }) => {
    const response = await api.post<{ user: User }>('/auth/login', payload);
    setUser(response.user);
    navigate('/dashboard');
  };

  const register = async (payload: { name: string; email: string; password: string }) => {
    const response = await api.post<{ user: User; verificationToken?: string }>('/auth/register', payload);
    setUser(response.user);
    navigate(`/verify-email?token=${response.verificationToken || ''}`);
    return response;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-slate-200">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/70 px-5 py-3 text-sm text-slate-300 shadow-2xl shadow-black/30">
          <Activity className="h-4 w-4 animate-pulse text-[#C7F36B]" />
          Loading PulseWatch…
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C7F36B]/35 bg-[#C7F36B]/10 text-[#C7F36B]">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">PulseWatch</div>
            <div className="text-[10px] text-slate-500">uptime intelligence</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#how-it-works" className="transition hover:text-white">How it works</a>
          <a href="#monitoring" className="transition hover:text-white">Monitoring</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard" className="rounded-full border border-[#C7F36B]/40 bg-[#C7F36B]/10 px-4 py-2 text-sm font-medium text-[#C7F36B] transition hover:bg-[#C7F36B]/15">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#C7F36B]/40 hover:text-white">Login</Link>
              <Link to="/register" className="rounded-full bg-[#C7F36B] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#d4fb70]">Start free</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-18 pt-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:pb-24 lg:pt-14">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#67E8F9]/20 bg-[#67E8F9]/8 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#67E8F9]">
              <Sparkles className="h-3.5 w-3.5" />
              Developer-first uptime
            </div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
              Keep every app online and every incident visible.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              PulseWatch monitors production sites, checks HTTP health from real backend checks, and highlights outages before customers do.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-full bg-[#C7F36B] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#d4fb70]">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-slate-900">
                View login
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl gap-4 sm:grid-cols-3">
              {[
                { label: 'Checks each minute', value: '60s' },
                { label: 'Median response', value: '220ms' },
                { label: 'Open incidents', value: 'Live' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-[#111923] p-4">
                  <div className="text-xl font-semibold text-white">{item.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className=" rounded-3xl border border-white/10 bg-[#111923] p-4 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Workspace status</div>
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C7F36B]" />
                  Healthy system
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300">
                <BellRing className="h-3.5 w-3.5" />
                3 alerts
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Active monitors', value: '24', accent: 'text-[#C7F36B]' },
                { label: 'Healthy', value: '96.2%', accent: 'text-[#67E8F9]' },
                { label: 'Downtime', value: '0.4%', accent: 'text-rose-300' },
                { label: 'Open incidents', value: '2', accent: 'text-amber-200' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-[#17212D] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className={clsx('mt-3 text-2xl font-semibold', item.accent)}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0B0F14] p-4">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
                <span>Availability</span>
                <span>7d</span>
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[{ date: 'Mon', value: 90 }, { date: 'Tue', value: 94 }, { date: 'Wed', value: 92 }, { date: 'Thu', value: 99 }, { date: 'Fri', value: 98 }, { date: 'Sat', value: 100 }, { date: 'Sun', value: 99 }]}>
                    <defs>
                      <linearGradient id="colorUptime" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#C7F36B" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#C7F36B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#C7F36B" strokeWidth={3} fill="url(#colorUptime)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#67E8F9]">Built for teams</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">Performance without the noise.</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Globe, title: 'Web monitoring', text: 'Track public URLs with real HTTP health checks and response time capture.' },
              { icon: Gauge, title: 'Latency insight', text: 'Expose slowdowns before SOP or SEO regressions impact customers.' },
              { icon: ShieldCheck, title: 'Incident handling', text: 'Raise clear incidents the moment expected responses break.' },
              { icon: BellRing, title: 'Smart alerts', text: 'Notify your team instantly and cut through noisy status pages.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-[#111923] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#C7F36B]/20 bg-[#C7F36B]/10 text-[#C7F36B]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-t border-white/10 bg-[#0D1219]">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-3 lg:px-8">
            {[
              { number: '01', title: 'Add a monitor', text: 'Drop in a public URL, set status expectations, and define your check cadence.' },
              { number: '02', title: 'Measure every response', text: 'Track latency, uptime, HTTP status mismatches, and repeat failures in real time.' },
              { number: '03', title: 'Fix faster', text: 'Open incidents, route alerts, and keep recovery timelines visible to the whole team.' },
            ].map((item) => (
              <div key={item.number} className="rounded-2xl border border-white/10 bg-[#111923] p-6">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#67E8F9]">{item.number}</div>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="monitoring" className="mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-[#111923] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#C7F36B]">PulseWatch status</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">Live health snapshots</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#67E8F9]/25 bg-[#67E8F9]/8 px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#67E8F9]">
                <Activity className="h-3.5 w-3.5" />
                real checks, live data
              </div>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/10 bg-[#0B0F14] p-4">
                <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                  <span>Response time</span>
                  <span>24h</span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ key: '00:00', value: 260 }, { key: '04:00', value: 210 }, { key: '08:00', value: 190 }, { key: '12:00', value: 230 }, { key: '16:00', value: 320 }, { key: '20:00', value: 240 }, { key: '24:00', value: 220 }]}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis dataKey="key" stroke="#94A3B8" tickLine={false} axisLine={false} />
                      <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#67E8F9" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#17212D] p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                    <span>Current status</span>
                    <StatusBadge status="UP" />
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-white">99.3%</div>
                  <p className="mt-1 text-sm text-slate-300">Platform availability across active monitors.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#17212D] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Alert flow</div>
                  <ul className="mt-4 space-y-3 text-sm text-slate-300">
                    <li className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2"><span>HTTP mismatch</span><span className="text-[#C7F36B]">fire</span></li>
                    <li className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2"><span>Slow response</span><span className="text-[#67E8F9]">watch</span></li>
                    <li className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2"><span>Certificate issue</span><span className="text-rose-300">alert</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C7F36B]/35 bg-[#C7F36B]/10 text-[#C7F36B]">
              <Monitor className="h-4 w-4" />
            </div>
            PulseWatch
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-white">Login</Link>
            <Link to="/register" className="hover:text-white">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: 'admin@pulsewatch.app', password: 'PulseWatch123!' },
  });

  const onSubmit = async (values: { email: string; password: string }) => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(values);
    } catch (err) {
      setError((err as Error).message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your workspace">
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <input type="email" {...form.register('email')} className="input" placeholder="you@company.com" />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <input type="password" {...form.register('password')} className="input" placeholder="••••••••" />
        </Field>
        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex items-center justify-between text-sm text-slate-300">
          <Link to="/forgot-password" className="hover:text-white">Forgot password?</Link>
          <Link to="/register" className="hover:text-white">Create account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: 'Demo Operator', email: 'demo@pulsewatch.app', password: 'PulseWatch123!' },
  });

  const onSubmit = async (values: { name: string; email: string; password: string }) => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await registerUser(values);
      setSuccess(response.verificationToken ? `Verification token ready: ${response.verificationToken}` : 'Account created.');
    } catch (err) {
      setError((err as Error).message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your workspace" subtitle="Set up monitoring for every critical endpoint.">
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label="Full name" error={form.formState.errors.name?.message as string | undefined}>
          <input type="text" {...form.register('name')} className="input" placeholder="Alex Morgan" />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message as string | undefined}>
          <input type="email" {...form.register('email')} className="input" placeholder="you@company.com" />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message as string | undefined}>
          <input type="password" {...form.register('password')} className="input" placeholder="Choose a strong password" />
        </Field>
        <div className="rounded-2xl border border-[#C7F36B]/25 bg-[#C7F36B]/10 p-3 text-xs text-[#d9f99d]">
          Include at least one uppercase letter and a number.
        </div>
        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        {success ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{success}</div> : null}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
        <div className="text-center text-sm text-slate-300">
          Already registered? <Link to="/login" className="text-white hover:text-[#C7F36B]">Sign in</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: 'admin@pulsewatch.app' },
  });

  const onSubmit = async (values: { email: string }) => {
    setError('');
    setMessage('');
    try {
      const result = await api.post<{ resetToken?: string; message: string }>('/auth/forgot-password', values);
      setMessage(result.message);
      setToken(result.resetToken || null);
    } catch (err) {
      setError((err as Error).message || 'Unable to send reset email.');
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll issue a safe reset token for your account.">
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label="Email address">
          <input type="email" {...form.register('email')} className="input" placeholder="you@company.com" />
        </Field>
        {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}{token ? ` Token: ${token}` : ''}</div> : null}
        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        <button type="submit" className="btn-primary w-full">Send reset link</button>
        <div className="text-center text-sm text-slate-300">
          Need back in? <Link to="/login" className="text-white hover:text-[#C7F36B]">Sign in</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: 'PulseWatch123!' },
  });

  const onSubmit = async (values: { password: string }) => {
    setError('');
    setMessage('');
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      setMessage('Password updated successfully. You can now sign in.');
    } catch (err) {
      setError((err as Error).message || 'Unable to update password.');
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Use a strong, memorable password.">
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Token: <span className="font-mono text-[#67E8F9]">{token || 'missing'}</span>
        </div>
        <Field label="New password" error={form.formState.errors.password?.message as string | undefined}>
          <input type="password" {...form.register('password')} className="input" placeholder="Enter a new password" />
        </Field>
        {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        <button type="submit" className="btn-primary w-full">Update password</button>
      </form>
    </AuthLayout>
  );
}

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        setError('Missing verification token.');
        return;
      }

      try {
        const result = await api.post<{ message: string }>('/auth/verify-email', { token });
        setMessage(result.message);
      } catch (err) {
        setError((err as Error).message || 'Unable to verify email.');
      }
    };

    runVerification();
  }, [token]);

  return (
    <AuthLayout title="Verify your email" subtitle="Complete the final step to activate your account.">
      <div className="space-y-4">
        {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        <Link to="/login" className="btn-primary inline-flex w-full justify-center">Back to sign in</Link>
      </div>
    </AuthLayout>
  );
}

function DashboardPage() {
  const query = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get<DashboardOverview>('/dashboard/overview'),
  });

  const overview = query.data;

  if (query.isLoading) {
    return <DashboardLoadingState />;
  }

  if (query.isError || !overview) {
    return <SectionCard title="Dashboard unavailable">Unable to load monitoring metrics.</SectionCard>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#67E8F9]">Overview</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">Monitoring workspace</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#111923] px-3 py-2 text-sm text-slate-300">
          <Clock3 className="h-4 w-4 text-[#C7F36B]" />
          Last refresh {formatDate(new Date().toISOString())}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active monitors" value={String(overview.totalMonitors)} accent="#C7F36B" icon={<Monitor className="h-4 w-4" />} />
        <MetricCard label="Healthy monitors" value={String(overview.healthyMonitors)} accent="#67E8F9" icon={<CheckCircle2 className="h-4 w-4" />} />
        <MetricCard label="Monitors down" value={String(overview.downMonitors)} accent="#fca5a5" icon={<Activity className="h-4 w-4" />} />
        <MetricCard label="Open incidents" value={String(overview.openIncidents)} accent="#fbbf24" icon={<Bell className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <SectionCard title="Availability trend" subtitle="Last 7 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.availabilityTrend}>
                <defs>
                  <linearGradient id="uptimeFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#C7F36B" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#C7F36B" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" axisLine={false} tickLine={false} />
                <YAxis stroke="#94A3B8" axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="uptime" stroke="#C7F36B" fill="url(#uptimeFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="System health" subtitle="Response-time trend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.responseTimeTrend}>
                <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" axisLine={false} tickLine={false} />
                <YAxis stroke="#94A3B8" axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="responseTime" fill="#67E8F9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Recent checks" subtitle="Latest monitoring outcomes">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="py-3 pr-4">Monitor</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Latency</th>
                  <th className="py-3 pr-4">Checked</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentChecks.length ? overview.recentChecks.map((check) => (
                  <tr key={check.id} className="border-b border-white/8 last:border-0">
                    <td className="py-3 pr-4 font-medium text-white">{check.monitorName || 'Unknown'}</td>
                    <td className="py-3 pr-4"><StatusBadge status={check.status} /></td>
                    <td className="py-3 pr-4">{formatMs(check.responseTimeMs)}</td>
                    <td className="py-3 pr-4">{formatDate(check.checkedAt)}</td>
                  </tr>
                )) : <tr><td className="py-3 text-slate-400" colSpan={4}>No checks have been recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Active incidents" subtitle="Critical items requiring attention">
          <div className="space-y-3">
            {overview.incidentSummary.length ? overview.incidentSummary.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-[#17212D] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{item.monitor}</div>
                  </div>
                  <StatusBadge status={item.status === 'resolved' ? 'UP' : 'DOWN'} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span>{item.severity}</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </div>
            )) : <div className="text-sm text-slate-400">No active incidents.</div>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Monitor status" subtitle="Current route health">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-400">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">URL</th>
                <th className="py-3 pr-4">Latency</th>
                <th className="py-3 pr-4">Last check</th>
              </tr>
            </thead>
            <tbody>
              {overview.monitors.length ? overview.monitors.map((monitor) => (
                <tr key={monitor.id} className="border-b border-white/8 last:border-0">
                  <td className="py-3 pr-4 font-medium text-white">{monitor.name}</td>
                  <td className="py-3 pr-4"><StatusBadge status={monitor.status} /></td>
                  <td className="py-3 pr-4 text-slate-400">{monitor.url}</td>
                  <td className="py-3 pr-4">{formatMs(monitor.responseTimeMs)}</td>
                  <td className="py-3 pr-4">{formatDate(monitor.lastCheck)}</td>
                </tr>
              )) : <tr><td className="py-3 text-slate-400" colSpan={5}>No monitors are configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function MonitorsPage() {
  const query = useQuery({
    queryKey: ['monitors'],
    queryFn: () => api.get<{ monitors: Monitor[] }>('/monitors'),
  });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const monitors = query.data?.monitors || [];
  const filtered = monitors.filter((monitor) => {
    const matchesSearch = `${monitor.name} ${monitor.url}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || monitor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const runCheck = useMutation({
    mutationFn: (monitorId: string) => api.post(`/monitors/${monitorId}/check`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const toggleMonitor = useMutation({
    mutationFn: ({ monitorId }: { monitorId: string }) => api.patch(`/monitors/${monitorId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const deleteMonitor = useMutation({
    mutationFn: ({ monitorId }: { monitorId: string }) => api.del(`/monitors/${monitorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#67E8F9]">Monitors</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">Managed endpoints</h1>
        </div>
        <Link to="/monitors/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add monitor
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111923] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search by name or host" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.16em] text-slate-400">Filter</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#C7F36B]">
              <option value="all">All</option>
              <option value="UP">Healthy</option>
              <option value="DOWN">Down</option>
              <option value="PAUSED">Paused</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111923] p-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-400">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">URL</th>
                <th className="py-3 pr-4">Tags</th>
                <th className="py-3 pr-4">Latency</th>
                <th className="py-3 pr-4">Last check</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((monitor) => (
                <tr key={monitor.id} className="border-b border-white/8 last:border-0">
                  <td className="py-3 pr-4">
                    <Link to={`/monitors/${monitor.id}`} className="font-medium text-white hover:text-[#C7F36B]">{monitor.name}</Link>
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={monitor.status} /></td>
                  <td className="py-3 pr-4 text-slate-400">{monitor.url}</td>
                  <td className="py-3 pr-4">{monitor.tags.length ? monitor.tags.join(', ') : 'No tags'}</td>
                  <td className="py-3 pr-4">{formatMs(monitor.responseTimeMs)}</td>
                  <td className="py-3 pr-4">{formatDate(monitor.lastCheck)}</td>
                  <td className="py-3 pr-4">
                    <div className="flex justify-end gap-2">
                      <button className="icon-btn" onClick={() => runCheck.mutate(monitor.id)} title="Run check"><RefreshCcw className="h-4 w-4" /></button>
                      <button className="icon-btn" onClick={() => toggleMonitor.mutate({ monitorId: monitor.id })} title={monitor.paused ? 'Resume' : 'Pause'}>{monitor.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
                      <Link to={`/monitors/${monitor.id}/edit`} className="icon-btn" title="Edit monitor"><ServerCog className="h-4 w-4" /></Link>
                      <button className="icon-btn text-rose-300 hover:bg-rose-500/10" onClick={() => deleteMonitor.mutate({ monitorId: monitor.id })} title="Delete monitor"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MonitorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(monitorSchema),
    defaultValues: {
      name: 'PulseWatch Docs',
      url: 'https://example.com',
      intervalMs: 300000,
      timeoutMs: 12000,
      expectedStatusCodes: '200,201,204',
      tags: 'docs,ops',
      alertPreferences: 'email',
    },
  });

  const existing = useQuery({
    queryKey: ['monitor', id],
    queryFn: () => api.get<{ monitor: Monitor; checks: CheckEntry[] }>(`/monitors/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (existing.data?.monitor) {
      form.reset({
        name: existing.data.monitor.name,
        url: existing.data.monitor.url,
        intervalMs: existing.data.monitor.intervalMs,
        timeoutMs: existing.data.monitor.timeoutMs,
        expectedStatusCodes: existing.data.monitor.expectedStatusCodes.join(','),
        tags: existing.data.monitor.tags.join(','),
        alertPreferences: existing.data.monitor.alertPreferences.join(','),
      });
    }
  }, [existing.data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        expectedStatusCodes: String(values.expectedStatusCodes)
          .split(',')
          .map((v: string) => Number(v.trim()))
          .filter((value: number) => !Number.isNaN(value)),
        tags: String(values.tags || '')
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
        alertPreferences: String(values.alertPreferences || '')
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
      };

      if (isEditing) {
        return api.patch<{ monitor: Monitor }>(`/monitors/${id}`, payload);
      }

      return api.post<{ monitor: Monitor }>('/monitors', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      navigate('/monitors');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[#67E8F9]">{isEditing ? 'Edit monitor' : 'Add monitor'}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">{isEditing ? 'Update endpoint' : 'Create a new monitor'}</h1>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#111923] p-5">
        <form className="grid gap-5 lg:grid-cols-2" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} noValidate>
          <Field label="Monitor name" error={form.formState.errors.name?.message as string | undefined}>
            <input {...form.register('name')} className="input" />
          </Field>
          <Field label="Check interval (ms)" error={form.formState.errors.intervalMs?.message as string | undefined}>
            <input type="number" {...form.register('intervalMs')} className="input" />
          </Field>
          <Field label="Public URL" className="lg:col-span-2" error={form.formState.errors.url?.message as string | undefined}>
            <input {...form.register('url')} className="input" placeholder="https://api.example.com/health" />
          </Field>
          <Field label="Request timeout (ms)" error={form.formState.errors.timeoutMs?.message as string | undefined}>
            <input type="number" {...form.register('timeoutMs')} className="input" />
          </Field>
          <Field label="Expected status codes" error={form.formState.errors.expectedStatusCodes?.message as string | undefined}>
            <input {...form.register('expectedStatusCodes')} className="input" placeholder="200,201,204" />
          </Field>
          <Field label="Tags" error={form.formState.errors.tags?.message as string | undefined} className="lg:col-span-2">
            <input {...form.register('tags')} className="input" placeholder="prod,marketing,api" />
          </Field>
          <Field label="Alert preferences" error={form.formState.errors.alertPreferences?.message as string | undefined} className="lg:col-span-2">
            <input {...form.register('alertPreferences')} className="input" placeholder="email,slack" />
          </Field>

          <div className="lg:col-span-2 flex items-center justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => navigate('/monitors')}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : isEditing ? 'Update monitor' : 'Create monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MonitorDetailPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['monitor', id],
    queryFn: () => api.get<{ monitor: Monitor; checks: CheckEntry[] }>(`/monitors/${id}`),
    enabled: !!id,
  });

  const monitor = query.data?.monitor;
  const checks = query.data?.checks || [];

  if (query.isLoading) {
    return <DashboardLoadingState />;
  }

  if (!monitor) {
    return <SectionCard title="Monitor not found">The requested monitor could not be found.</SectionCard>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#67E8F9]">Monitor details</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">{monitor.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={monitor.status} />
          <Link to={`/monitors/${monitor.id}/edit`} className="btn-secondary">Edit</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Status" value={monitor.status} accent="#C7F36B" icon={<ShieldCheck className="h-4 w-4" />} />
        <MetricCard label="Latency" value={formatMs(monitor.responseTimeMs)} accent="#67E8F9" icon={<Gauge className="h-4 w-4" />} />
        <MetricCard label="Check interval" value={`${monitor.intervalMs / 1000}s`} accent="#fbbf24" icon={<Clock3 className="h-4 w-4" />} />
        <MetricCard label="Expected codes" value={monitor.expectedStatusCodes.join(', ')} accent="#a7f3d0" icon={<Command className="h-4 w-4" />} />
      </div>

      <SectionCard title="Endpoint summary" subtitle={monitor.url}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#17212D] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">URL</div>
            <div className="mt-3 flex items-center gap-2 text-white">
              {monitor.url}
              <a href={monitor.url} target="_blank" rel="noreferrer" className="text-[#67E8F9]"><ExternalLink className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#17212D] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Last check</div>
            <div className="mt-3 text-white">{formatDate(monitor.lastCheck)}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recent checks" subtitle="Your latest request results">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-400">
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Code</th>
                <th className="py-3 pr-4">Latency</th>
                <th className="py-3 pr-4">Checked</th>
                <th className="py-3 pr-4">Error</th>
              </tr>
            </thead>
            <tbody>
              {checks.length ? checks.map((check) => (
                <tr key={check.id} className="border-b border-white/8 last:border-0">
                  <td className="py-3 pr-4"><StatusBadge status={check.status} /></td>
                  <td className="py-3 pr-4">{check.statusCode ?? '—'}</td>
                  <td className="py-3 pr-4">{formatMs(check.responseTimeMs)}</td>
                  <td className="py-3 pr-4">{formatDate(check.checkedAt)}</td>
                  <td className="py-3 pr-4 text-slate-400">{check.error || 'None'}</td>
                </tr>
              )) : <tr><td className="py-3 text-slate-400" colSpan={5}>No checks recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((card) => (
        <div key={card} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-[#111923]" />
      ))}
    </div>
  );
}

function MetricCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111923] p-4">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-[11px] uppercase tracking-[0.18em]">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70" style={{ color: accent }}>{icon}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-white" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111923] p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle ? <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{subtitle}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111923] p-6 shadow-2xl shadow-black/40" >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C7F36B]/35 bg-[#C7F36B]/10 text-[#C7F36B]">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">PulseWatch</div>
            </div>
          </div>
          <Link to="/" className="text-sm text-slate-400 hover:text-white">Home</Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-[-0.06em] text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const nav = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/monitors', label: 'Monitors', icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-200">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-white/10 bg-[#0D1219] p-4 lg:block">
          <div className="flex items-center gap-3 px-2 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C7F36B]/35 bg-[#C7F36B]/10 text-[#C7F36B]">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">PulseWatch</div>
              <div className="text-sm font-semibold text-white">Workspace</div>
            </div>
          </div>

          <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => clsx('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-[#C7F36B]/10 text-[#C7F36B] ring-1 ring-inset ring-[#C7F36B]/20' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111923] p-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">Quick actions</div>
            <div className="space-y-2">
              <Link to="/monitors/new" className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 hover:border-[#C7F36B]/30 hover:text-white">
                <span>New monitor</span>
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </aside>

        <main className="flex-1 rounded-3xl border border-white/10 bg-[#0D1219] p-4 md:p-6">
          <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <button className="rounded-xl border border-white/10 bg-[#111923] p-2 lg:hidden" onClick={() => navigate('/monitors')}>
                <Monitor className="h-4 w-4" />
              </button>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">PulseWatch</div>
                <div className="text-xl font-semibold text-white">Developer workspace</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="icon-btn" aria-label="Open notification center"><Bell className="h-4 w-4" /></button>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111923] px-2.5 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C7F36B] text-sm font-semibold text-slate-950">{user?.name?.charAt(0).toUpperCase() || 'P'}</div>
                <div className="hidden text-left text-sm sm:block">
                  <div className="font-medium text-white">{user?.name || 'PulseWatch User'}</div>
                  <div className="text-xs text-slate-400">{user?.email || 'team@pulsewatch.app'}</div>
                </div>
              </div>
              <button className="icon-btn text-slate-300 hover:text-white" aria-label="Log out" onClick={() => void logout()}><LogOut className="h-4 w-4" /></button>
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}

export default App;
