import { useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
}

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  notes?: string;
  items?: OrderItem[];
}

const mockStockLevelData = [
  { name: "Week 1", inStock: 120, lowStock: 20, outOfStock: 5 },
  { name: "Week 2", inStock: 115, lowStock: 22, outOfStock: 8 },
  { name: "Week 3", inStock: 130, lowStock: 15, outOfStock: 4 },
  { name: "Week 4", inStock: 110, lowStock: 25, outOfStock: 10 },
  { name: "Week 5", inStock: 105, lowStock: 30, outOfStock: 12 },
  { name: "Week 6", inStock: 125, lowStock: 18, outOfStock: 7 },
];

const mockOrdersData = [
  { name: "Jan", pending: 12, shipped: 24, cancelled: 2 },
  { name: "Feb", pending: 15, shipped: 28, cancelled: 3 },
  { name: "Mar", pending: 18, shipped: 32, cancelled: 1 },
  { name: "Apr", pending: 14, shipped: 26, cancelled: 4 },
  { name: "May", pending: 20, shipped: 35, cancelled: 2 },
  { name: "Jun", pending: 22, shipped: 38, cancelled: 3 },
];

const mockCategoryData = [
  { name: "Widgets", value: 45 },
  { name: "Connectors", value: 25 },
  { name: "Brackets", value: 15 },
  { name: "Mounts", value: 10 },
  { name: "Other", value: 5 },
];

const Reports = () => {
  const { setCurrentPage } = useSidebar();
  
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  useEffect(() => {
    setCurrentPage("Reports");
  }, [setCurrentPage]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50">
            <i className="fas fa-download mr-2"></i>
            Export
          </button>
          <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50">
            <i className="fas fa-print mr-2"></i>
            Print
          </button>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Status Over Time</CardTitle>
              <CardDescription>
                Track inventory levels for the past 6 weeks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mockStockLevelData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="inStock"
                      stroke="#4ade80"
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="lowStock"
                      stroke="#fbbf24"
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="outOfStock"
                      stroke="#ef4444"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                  <p className="text-emerald-600 text-sm font-medium">In Stock Items</p>
                  <p className="text-2xl font-bold text-emerald-800">
                    {products?.filter(p => p.currentStock > p.minStockLevel).length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                  <p className="text-amber-600 text-sm font-medium">Low Stock Items</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {products?.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <p className="text-red-600 text-sm font-medium">Out of Stock Items</p>
                  <p className="text-2xl font-bold text-red-800">
                    {products?.filter(p => p.currentStock === 0).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Status By Month</CardTitle>
              <CardDescription>
                Track order status for the past 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={mockOrdersData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="pending" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="shipped" stackId="a" fill="#4ade80" />
                    <Bar dataKey="cancelled" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                  <p className="text-amber-600 text-sm font-medium">Pending Orders</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {orders?.filter(o => o.status === 'pending').length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                  <p className="text-emerald-600 text-sm font-medium">Shipped Orders</p>
                  <p className="text-2xl font-bold text-emerald-800">
                    {orders?.filter(o => o.status === 'shipped').length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <p className="text-red-600 text-sm font-medium">Cancelled Orders</p>
                  <p className="text-2xl font-bold text-red-800">
                    {orders?.filter(o => o.status === 'cancelled').length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Products by Category</CardTitle>
              <CardDescription>
                Distribution of products across categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={mockCategoryData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-2 px-4 text-left font-medium text-slate-600">Category</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Count</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {mockCategoryData.map((category) => (
                      <tr key={category.name}>
                        <td className="py-2 px-4">{category.name}</td>
                        <td className="py-2 px-4 text-right">{category.value}</td>
                        <td className="py-2 px-4 text-right">
                          {(category.value / mockCategoryData.reduce((acc, curr) => acc + curr.value, 0) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;