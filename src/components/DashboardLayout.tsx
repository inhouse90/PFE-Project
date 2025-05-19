import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Package, ShoppingCart, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) navigate('/signin');
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <Package className="h-5 w-5" /> },
    { path: '/dashboard/products', label: 'Products', icon: <Package className="h-5 w-5" /> },
    { path: '/dashboard/orders', label: 'Orders', icon: <ShoppingCart className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:block w-64 bg-gray-800 text-white">
        <div className="p-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <nav className="mt-4">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 ${location.pathname === item.path ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 absolute bottom-0 w-full">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700" onClick={handleLogout}>
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden fixed top-4 left-4 z-50">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-gray-800 text-white">
          <div className="p-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <nav className="mt-4">
            <ul>
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 ${location.pathname === item.path ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="p-4">
            <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700" onClick={handleLogout}>
              <LogOut className="mr-2 h-5 w-5" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 p-6 bg-gray-100">{children}</main>
    </div>
  );
};

export default DashboardLayout;