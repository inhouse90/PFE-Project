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
    { path: '/dashboard', label: 'Dashboard', icon: <Package className="h-5 w-5 text-blue-500" /> },
    { path: '/dashboard/products', label: 'Products', icon: <Package className="h-5 w-5 text-blue-500" /> },
    { path: '/dashboard/orders', label: 'Orders', icon: <ShoppingCart className="h-5 w-5 text-blue-500" /> },
  ];

  return (
    <div className="min-h-screen flex font-sans">
      <aside className="hidden md:block w-64 bg-gray-900 text-white border-r border-gray-700 shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        </div>
        <nav className="mt-4">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-6 py-3 text-gray-400 hover:bg-gray-800 hover:text-blue-400 transition-colors text-sm font-medium ${
                    location.pathname === item.path ? 'bg-gray-800 text-blue-400 border-l-4 border-blue-600' : ''
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-6 absolute bottom-0 w-full">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors text-sm font-medium"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5 text-blue-500" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 bg-gray-900 border-gray-700 text-blue-400 hover:bg-blue-900/50"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-gray-900 text-white border-r border-gray-700 font-sans">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <nav className="mt-4">
            <ul>
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-6 py-3 text-gray-400 hover:bg-gray-800 hover:text-blue-400 transition-colors text-sm font-medium ${
                      location.pathname === item.path ? 'bg-gray-800 text-blue-400 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="p-6">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors text-sm font-medium"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-5 w-5 text-blue-500" />
              <span>Logout</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 bg-gray-900">{children}</main>
    </div>
  );
};

export default DashboardLayout;