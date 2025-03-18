import { useState, useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface InventoryTrendItem {
  name: string;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

interface OrdersTrendItem {
  name: string;
  pending: number;
  picked: number;
  shipped: number;
  cancelled: number;
}

interface CategoryItem {
  name: string;
  value: number;
}

interface TopSellingProduct {
  id: number;
  name: string;
  sku: string;
  soldQuantity: number;
}

interface InventoryValueReport {
  totalValue: number;
  categoryBreakdown: {
    category: string;
    productCount: number;
    totalValue: number;
    percentageOfTotal: number;
  }[];
}

interface PickingEfficiencyReport {
  averagePickingTimeMinutes: number;
  pickingEfficiency: {
    date: string;
    ordersProcessed: number;
    avgTimeMinutes: number;
  }[];
}

// Colors for charts
const COLORS = ['#4ade80', '#3b82f6', '#f97316', '#ec4899', '#8b5cf6', '#fbbf24', '#ef4444'];

const Reports = () => {
  const { setCurrentPage } = useSidebar();
  const [timeRange, setTimeRange] = useState<string>("6");
  const [exportFormat, setExportFormat] = useState<string>("csv");
  
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const { data: inventoryTrend = [], isLoading: isLoadingInventoryTrend } = useQuery<InventoryTrendItem[]>({
    queryKey: ['/api/analytics/inventory-trend', timeRange],
  });

  const { data: ordersTrend = [], isLoading: isLoadingOrdersTrend } = useQuery<OrdersTrendItem[]>({
    queryKey: ['/api/analytics/orders-trend', timeRange],
  });

  const { data: categoriesData = [], isLoading: isLoadingCategories } = useQuery<CategoryItem[]>({
    queryKey: ['/api/analytics/product-categories'],
  });

  const { data: topSellingProducts = [], isLoading: isLoadingTopProducts } = useQuery<TopSellingProduct[]>({
    queryKey: ['/api/analytics/top-selling-products'],
  });

  const { data: inventoryValue, isLoading: isLoadingInventoryValue } = useQuery<InventoryValueReport>({
    queryKey: ['/api/analytics/inventory-value'],
  });

  const { data: pickingEfficiency, isLoading: isLoadingPickingEfficiency } = useQuery<PickingEfficiencyReport>({
    queryKey: ['/api/analytics/picking-efficiency'],
  });

  useEffect(() => {
    setCurrentPage("Reports");
  }, [setCurrentPage]);

  // Function to handle exporting reports
  const handleExport = (reportType: string) => {
    // In a real application, this would generate a file for download
    // For now, we'll just show an alert
    alert(`Exporting ${reportType} report as ${exportFormat.toUpperCase()}`);
  };

  // Function to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Advanced Reports & Analytics</h1>
        <div className="flex items-center space-x-2">
          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center gap-2">
            <i className="fas fa-download"></i>
            Export
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <i className="fas fa-print"></i>
            Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="value">Value Analysis</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
        </TabsList>
        
        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Inventory Status Over Time</CardTitle>
                  <CardDescription>
                    Track inventory levels for the past {timeRange} weeks
                  </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 Weeks</SelectItem>
                    <SelectItem value="6">6 Weeks</SelectItem>
                    <SelectItem value="12">12 Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={inventoryTrend}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="inStock"
                      stackId="1"
                      stroke="#4ade80"
                      fill="#4ade80"
                    />
                    <Area
                      type="monotone"
                      dataKey="lowStock"
                      stackId="1"
                      stroke="#fbbf24"
                      fill="#fbbf24"
                    />
                    <Area
                      type="monotone"
                      dataKey="outOfStock"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4 w-full">
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
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>
                Products with highest sales volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topSellingProducts}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip />
                    <Bar dataKey="soldQuantity" fill="#3b82f6">
                      {topSellingProducts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock Level Distribution</CardTitle>
              <CardDescription>
                Current inventory status breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { 
                          name: 'In Stock', 
                          value: products?.filter(p => p.currentStock > p.minStockLevel).length || 0 
                        },
                        { 
                          name: 'Low Stock', 
                          value: products?.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length || 0 
                        },
                        { 
                          name: 'Out of Stock', 
                          value: products?.filter(p => p.currentStock === 0).length || 0 
                        },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#4ade80" />
                      <Cell fill="#fbbf24" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Order Status By Month</CardTitle>
                  <CardDescription>
                    Track order status for the past {timeRange} months
                  </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ordersTrend}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="pending" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="picked" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="shipped" stackId="a" fill="#4ade80" />
                    <Bar dataKey="cancelled" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="grid grid-cols-4 gap-4 w-full">
                <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                  <p className="text-amber-600 text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {orders?.filter(o => o.status === 'pending').length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <p className="text-blue-600 text-sm font-medium">Picked</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {orders?.filter(o => o.status === 'picked').length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                  <p className="text-emerald-600 text-sm font-medium">Shipped</p>
                  <p className="text-2xl font-bold text-emerald-800">
                    {orders?.filter(o => o.status === 'shipped').length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <p className="text-red-600 text-sm font-medium">Cancelled</p>
                  <p className="text-2xl font-bold text-red-800">
                    {orders?.filter(o => o.status === 'cancelled').length || 0}
                  </p>
                </div>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Status Distribution</CardTitle>
              <CardDescription>
                Current order status breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pending', value: orders?.filter(o => o.status === 'pending').length || 0 },
                        { name: 'Picked', value: orders?.filter(o => o.status === 'picked').length || 0 },
                        { name: 'Shipped', value: orders?.filter(o => o.status === 'shipped').length || 0 },
                        { name: 'Cancelled', value: orders?.filter(o => o.status === 'cancelled').length || 0 },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#fbbf24" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="#4ade80" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Order Trend</CardTitle>
              <CardDescription>
                Order volume over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ordersTrend}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="shipped" 
                      stroke="#4ade80" 
                      strokeWidth={2}
                      activeDot={{ r: 8 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pending" 
                      stroke="#fbbf24" 
                      strokeWidth={2}
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Products by Category</CardTitle>
              <CardDescription>
                Distribution of products across categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={categoriesData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#3b82f6">
                        {categoriesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoriesData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoriesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="w-full">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-2 px-4 text-left font-medium text-slate-600">Category</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Count</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {categoriesData.map((category) => (
                      <tr key={category.name}>
                        <td className="py-2 px-4">{category.name}</td>
                        <td className="py-2 px-4 text-right">{category.value}</td>
                        <td className="py-2 px-4 text-right">
                          {(category.value / categoriesData.reduce((acc, curr) => acc + curr.value, 0) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Value Analysis Tab */}
        <TabsContent value="value" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Inventory Value Analysis</CardTitle>
              <CardDescription>
                Total inventory value: {inventoryValue ? formatCurrency(inventoryValue.totalValue) : 'Loading...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={inventoryValue?.categoryBreakdown}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" 
                        tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis type="category" dataKey="category" width={100} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Bar dataKey="totalValue" name="Value" fill="#3b82f6">
                        {inventoryValue?.categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryValue?.categoryBreakdown}
                        dataKey="totalValue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {inventoryValue?.categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="w-full">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-2 px-4 text-left font-medium text-slate-600">Category</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Count</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Value</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inventoryValue?.categoryBreakdown.map((category) => (
                      <tr key={category.category}>
                        <td className="py-2 px-4">{category.category}</td>
                        <td className="py-2 px-4 text-right">{category.productCount}</td>
                        <td className="py-2 px-4 text-right">{formatCurrency(category.totalValue)}</td>
                        <td className="py-2 px-4 text-right">
                          {category.percentageOfTotal.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    <tr className="font-medium bg-slate-50">
                      <td className="py-2 px-4">Total</td>
                      <td className="py-2 px-4 text-right">
                        {inventoryValue?.categoryBreakdown.reduce((acc, curr) => acc + curr.productCount, 0)}
                      </td>
                      <td className="py-2 px-4 text-right">{inventoryValue ? formatCurrency(inventoryValue.totalValue) : '-'}</td>
                      <td className="py-2 px-4 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Efficiency Tab */}
        <TabsContent value="efficiency" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Warehouse Picking Efficiency</CardTitle>
              <CardDescription>
                Average picking time: {pickingEfficiency ? `${pickingEfficiency.averagePickingTimeMinutes.toFixed(1)} minutes` : 'Loading...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={pickingEfficiency?.pickingEfficiency}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                    <YAxis yAxisId="right" orientation="right" stroke="#f97316" />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="ordersProcessed" 
                      name="Orders Processed"
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      activeDot={{ r: 8 }} 
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="avgTimeMinutes" 
                      name="Avg Time (min)"
                      stroke="#f97316" 
                      strokeWidth={2}
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="w-full">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-2 px-4 text-left font-medium text-slate-600">Date</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Orders Processed</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Avg Time (min)</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">Total Time (min)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pickingEfficiency?.pickingEfficiency.map((day) => (
                      <tr key={day.date}>
                        <td className="py-2 px-4">{new Date(day.date).toLocaleDateString()}</td>
                        <td className="py-2 px-4 text-right">{day.ordersProcessed}</td>
                        <td className="py-2 px-4 text-right">{day.avgTimeMinutes.toFixed(1)}</td>
                        <td className="py-2 px-4 text-right">{(day.ordersProcessed * day.avgTimeMinutes).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;