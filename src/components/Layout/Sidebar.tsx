import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, FolderGit2, Users, Settings, Shield, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { useSidebar } from '@/contexts/sidebarContext';

export default function Sidebar() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { collapsed } = useSidebar();
  
  const navItems = [
    { name: 'Bảng điều khiển', href: '/', icon: Home, roles: ['ALL'] },
    { name: 'Dự án', href: '/projects', icon: FolderGit2, roles: ['ALL'] },
    { name: 'Phòng ban', href: '/departments', icon: Building2, roles: ['ADMIN'] },
    { name: 'Người dùng', href: '/users', icon: Users, roles: ['ADMIN'] },
    { name: 'Vai trò', href: '/roles', icon: Shield, roles: ['ADMIN'] },
    { name: 'Cài đặt', href: '/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  const visibleNavItems = navItems.filter(item => 
    item.roles.includes('ALL') || (user && item.roles.includes(user.role))
  );

  return (
    <aside
      className={clsx(
        'z-20 flex h-screen shrink-0 flex-col bg-slate-900 text-slate-300',
        'shadow-xl shadow-slate-900/20 transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div
        className={clsx(
          'flex min-h-16 shrink-0 items-center border-b border-slate-800',
          collapsed ? 'justify-center px-1 py-2' : 'px-3'
        )}
      >
        {collapsed ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] font-black text-white" aria-hidden>
            P
          </div>
        ) : (
          <h1 className="min-w-0 truncate text-lg font-bold tracking-tight text-white">Quản trị PMS</h1>
        )}
      </div>
      <nav
        className={clsx('flex-1 py-4 space-y-0.5 overflow-y-auto', collapsed ? 'px-1.5' : 'px-3')}
      >
        {visibleNavItems.map((item) => {
          const isActive = router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={clsx(
                'flex items-center rounded-md text-sm font-medium transition-colors',
                collapsed ? 'justify-center py-2.5' : 'px-3 py-2',
                isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className={clsx('h-5 w-5 flex-shrink-0', !collapsed && 'mr-3')} />
              {collapsed ? <span className="sr-only">{item.name}</span> : item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
