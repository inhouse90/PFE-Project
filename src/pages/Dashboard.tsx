import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useProducts } from "@/contexts/ProductContext";
import { 
  Package, Users, ShoppingCart, DollarSign, 
  ArrowUpRight, ArrowDownRight, BarChart
} from "lucide-react";

const Dashboard = () => {
  const { products } = useProducts();
  
  const totalProducts = products.length;
  const totalStock = products.reduce((acc, product) => acc + product.stock, 0);
  const totalValue = products.reduce((acc, product) => acc + (product.price * product.stock), 0);
  
  const statsCards = [
    {
      title: "Total Products",
      value: totalProducts,
      description: "Products in inventory",
      icon: <Package className="h-5 w-5 text-blue-500" />,
      trend: { value: "+12.5%", isPositive: true }
    },
    {
      title: "Total Stock",
      value: totalStock,
      description: "Items in warehouse",
      icon: <ShoppingCart className="h-5 w-5 text-blue-500" />,
      trend: { value: "+3.2%", isPositive: true }
    },
    {
      title: "Inventory Value",
      value: `$${totalValue.toLocaleString()}`,
      description: "Total value of products",
      icon: <DollarSign className="h-5 w-5 text-blue-500" />,
      trend: { value: "-2.1%", isPositive: false }
    },
    {
      title: "Active Users",
      value: "214",
      description: "Users this month",
      icon: <Users className="h-5 w-5 text-blue-500" />,
      trend: { value: "+18.7%", isPositive: true }
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 bg-gray-900 text-white min-h-screen p-6 font-sans">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-sm text-gray-400 font-normal">Welcome to your admin dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((card, index) => (
            <Card key={index} className="bg-black border border-gray-700 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">{card.title}</CardTitle>
                <div className="p-2 bg-blue-900/50 rounded-md">{card.icon}</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{card.value}</div>
                <p className="text-xs text-gray-400 font-normal">{card.description}</p>
              </CardContent>
              <CardFooter>
                <div className={`flex items-center text-xs font-normal ${card.trend.isPositive ? 'text-blue-400' : 'text-red-400'}`}>
                  {card.trend.isPositive ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  <span>{card.trend.value} from last month</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-black border border-gray-700 rounded-lg shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Latest Products</CardTitle>
              <CardDescription className="text-xs text-gray-400 font-normal">Most recently added products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md bg-blue-900/50 flex items-center justify-center">
                      <Package className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 font-normal truncate">{product.category}</p>
                    </div>
                    <div className="text-sm font-medium text-blue-400">${product.price.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black border border-gray-700 rounded-lg shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Stock Status</CardTitle>
              <CardDescription className="text-xs text-gray-400 font-normal">Current inventory levels</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center justify-center">
                <BarChart className="h-16 w-16 text-blue-500 mb-4" />
                <p className="text-sm text-gray-400 font-normal text-center">
                  Product inventory chart would display here in a real implementation
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;