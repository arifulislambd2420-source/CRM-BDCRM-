import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Columns3,
  UserCog,
  Settings,
  LogOut,
  BookOpen,
  Package,
  ShoppingCart,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: Role[];
}

const items: NavItem[] = [
  { to: '/', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, roles: ['admin', 'sub_admin', 'store_manager'] },
  { to: '/customers', label: 'কাস্টমার', icon: Users, roles: ['admin', 'sub_admin', 'store_manager'] },
  { to: '/pipeline', label: 'পাইপলাইন', icon: Columns3, roles: ['admin', 'sub_admin', 'store_manager'] },
  { to: '/products', label: 'প্রোডাক্ট', icon: Package, roles: ['admin', 'sub_admin', 'store_manager'] },
  { to: '/orders', label: 'অর্ডার', icon: ShoppingCart, roles: ['admin', 'sub_admin', 'store_manager'] },
  { to: '/inbox', label: 'ইনবক্স', icon: MessageSquare, roles: ['admin', 'sub_admin', 'store_manager'] },
  { to: '/users', label: 'ইউজার ম্যানেজমেন্ট', icon: UserCog, roles: ['admin'] },
  { to: '/settings', label: 'সেটিংস', icon: Settings, roles: ['admin'] },
];

const roleLabels: Record<Role, string> = {
  admin: 'অ্যাডমিন',
  sub_admin: 'সাব-অ্যাডমিন',
  store_manager: 'শাখা ম্যানেজার',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <aside className="w-64 shrink-0 bg-navy-900 text-navy-100 flex flex-col min-h-screen">
      <div className="p-5 border-b border-navy-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-gold-500 flex items-center justify-center text-white">
          <BookOpen size={20} />
        </div>
        <div>
          <div className="font-semibold text-white text-sm leading-tight">প্রকাশনী CRM</div>
          <div className="text-xs text-navy-300">শিক্ষা প্রকাশনা</div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {items
          .filter((i) => i.roles.includes(user.role))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-navy-800 text-white'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
      </nav>

      <div className="p-3 border-t border-navy-800">
        <div className="px-2 pb-3">
          <div className="text-sm text-white truncate">{user.name}</div>
          <div className="text-xs text-navy-300">{roleLabels[user.role]}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          লগ আউট
        </button>
      </div>
    </aside>
  );
}
