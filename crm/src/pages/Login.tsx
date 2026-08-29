import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const demoAccounts = [
  { role: 'অ্যাডমিন', email: 'admin@prokashoni.bd', password: 'admin123' },
  { role: 'সাব-অ্যাডমিন', email: 'subadmin@prokashoni.bd', password: 'sub123' },
  { role: 'শাখা ম্যানেজার (ঢাকা)', email: 'dhaka@prokashoni.bd', password: 'store123' },
  { role: 'শাখা ম্যানেজার (চট্টগ্রাম)', email: 'ctg@prokashoni.bd', password: 'store123' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'কিছু একটা ভুল হয়েছে।');
    } finally {
      setBusy(false);
    }
  }

  function fill(a: typeof demoAccounts[number]) {
    setEmail(a.email);
    setPassword(a.password);
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-md bg-gold-500 flex items-center justify-center text-white">
            <BookOpen size={22} />
          </div>
          <div className="text-white">
            <div className="font-semibold text-lg leading-tight">প্রকাশনী CRM</div>
            <div className="text-xs text-navy-300">শিক্ষা প্রকাশনা ব্যবস্থাপনা</div>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-navy-900 mb-1">লগ ইন করুন</h1>
          <p className="text-sm text-navy-500 mb-5">ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">ইমেইল</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@prokashoni.bd"
              />
            </div>
            <div>
              <label className="label">পাসওয়ার্ড</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {err}
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'অপেক্ষা করুন…' : 'লগ ইন'}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-navy-100">
              <div className="text-xs font-medium text-navy-500 mb-2">ডেমো অ্যাকাউন্ট</div>
              <div className="grid grid-cols-1 gap-1.5">
                {demoAccounts.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => fill(a)}
                    className="text-left text-xs px-3 py-2 rounded-md bg-navy-50 hover:bg-navy-100 transition-colors"
                  >
                    <span className="font-medium text-navy-800">{a.role}</span>
                    <span className="text-navy-500"> · {a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
