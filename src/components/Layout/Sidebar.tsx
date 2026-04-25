import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, FolderGit2, Users, Settings, Shield, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';

export default function Sidebar() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
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
    <aside className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col fixed left-0 top-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">Quản trị PMS</h1>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
