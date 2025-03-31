import { useState, useEffect, useMemo } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

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

// New interfaces for the enhanced reporting area
interface CallLogsSummary {
  totalCalls: number;
  callTypeData: { name: string; value: number }[];
  callStatusData: { name: string; value: number }[];
  trendData: { date: string; count: number }[];
}

interface CustomerEngagement {
  totalCustomers: number;
  totalInteractions: number;
  avgCallsPerCustomer: number;
  engagementSegments: { name: string; value: number }[];
  topEngagedCustomers: {
    id: number;
    name: string;
    callCount: number;
    lastInteractionDate: string | null;
    daysSinceLastInteraction: number | null;
  }[];
}

interface OrderQualitySummary {
  totalErrors: number;
  totalShippedOrders: number;
  errorRate: number;
  errorsByType: { type: string; count: number }[];
  trending: { date: string; errorRate: number }[];
  totalErrorsInPeriod: number;
  resolvedErrorsCount: number;
  unresolvedErrorsCount: number;
  resolutionRate: number;
  avgResolutionTimeInDays: number;
  rootCauseAnalysis: Record<string, number>;
}

// New interfaces for Inventory Prediction
interface InventoryPrediction {
  id: number;
  productId: number;
  productName: string;
  generatedAt: string;
  predictionMethod: 'moving_average' | 'linear_regression' | 'seasonal_adjustment' | 'weighted_average' | 'manual';
  predictedDemand: number;
  confidenceLevel: number;
  accuracy: 'low' | 'medium' | 'high';
  predictedStockoutDate: string | null;
  recommendedReorderDate: string | null;
  recommendedQuantity: number | null;
  currentStock: number;
  notes: string | null;
}

interface PredictionMethodDistribution {
  method: string;
  count: number;
}

interface PredictionAccuracyDistribution {
  name: string;
  count: number;
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
  
  // New analytics data queries for enhanced reporting
  const { data: callLogsSummary, isLoading: isLoadingCallLogs } = useQuery<CallLogsSummary>({
    queryKey: ['/api/analytics/call-logs-summary', timeRange],
  });
  
  const { data: customerEngagement, isLoading: isLoadingCustomerEngagement } = useQuery<CustomerEngagement>({
    queryKey: ['/api/analytics/customer-engagement'],
  });
  
  const { data: orderQualitySummary, isLoading: isLoadingOrderQuality } = useQuery<OrderQualitySummary>({
    queryKey: ['/api/analytics/order-quality-summary', timeRange],
  });
  
  // Inventory prediction queries
  const { 
    data: productsRequiringReorder = [], 
    isLoading: isLoadingPredictions,
    isError: isReorderError,
    error: reorderError 
  } = useQuery<InventoryPrediction[]>({
    queryKey: ['/api/inventory-predictions/reorder-required'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/inventory-predictions/reorder-required');
        if (!response.ok) {
          throw new Error('Failed to fetch products requiring reorder');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching reorder data:', error);
        return [];
      }
    }
  });
  
  // Create derived data for prediction charts
  const predictionMethodsDistribution = useMemo(() => {
    const methodCounts: Record<string, number> = {};
    
    productsRequiringReorder.forEach(item => {
      const method = item.predictionMethod
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });
    
    return Object.entries(methodCounts).map(([method, count]) => ({ method, count }));
  }, [productsRequiringReorder]);
  
  const predictionAccuracyDistribution = useMemo(() => {
    const accuracyCounts: Record<string, number> = {
      'High': 0,
      'Medium': 0,
      'Low': 0
    };
    
    productsRequiringReorder.forEach(item => {
      const accuracy = item.accuracy.charAt(0).toUpperCase() + item.accuracy.slice(1);
      accuracyCounts[accuracy] = (accuracyCounts[accuracy] || 0) + 1;
    });
    
    return Object.entries(accuracyCounts).map(([name, count]) => ({ name, count }));
  }, [productsRequiringReorder]);

  useEffect(() => {
    setCurrentPage("Reports");
  }, [setCurrentPage]);

  // Function to handle exporting reports
  const handleExport = (reportType: string) => {
    let data: any[] = [];
    let title = `${reportType}_report`;
    
    // Determine which data to export based on the report type
    switch (reportType) {
      case 'inventory':
        // Prepare inventory data for export
        data = products.map(product => ({
          ID: product.id,
          Name: product.name,
          SKU: product.sku,
          Category: product.category,
          'Current Stock': product.currentStock,
          'Min Stock Level': product.minStockLevel,
          Status: product.currentStock > product.minStockLevel 
            ? 'In Stock' 
            : product.currentStock === 0 
              ? 'Out of Stock' 
              : 'Low Stock',
          Description: product.description || ''
        }));
        title = 'Inventory_Report';
        break;
        
      case 'orders':
        // Prepare orders data for export
        data = orders.map(order => ({
          ID: order.id,
          'Order Number': order.orderNumber,
          'Customer Name': order.customerName,
          'Order Date': new Date(order.orderDate).toLocaleDateString(),
          Status: order.status,
          Notes: order.notes || ''
        }));
        title = 'Orders_Report';
        break;
        
      case 'categories':
        // Prepare category data for export
        if (categoriesData.length > 0) {
          data = categoriesData.map(category => ({
            Category: category.name,
            'Product Count': category.value,
            'Percentage': ((category.value / categoriesData.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(1) + '%'
          }));
        }
        title = 'Categories_Report';
        break;
        
      case 'value':
        // Prepare inventory value data for export
        if (inventoryValue) {
          data = inventoryValue.categoryBreakdown.map(category => ({
            Category: category.category,
            'Product Count': category.productCount,
            'Total Value': formatCurrency(category.totalValue),
            'Percentage': category.percentageOfTotal.toFixed(1) + '%'
          }));
        }
        title = 'Inventory_Value_Report';
        break;
        
      case 'efficiency':
        // Prepare efficiency data for export
        if (pickingEfficiency) {
          data = pickingEfficiency.pickingEfficiency.map(item => ({
            Date: new Date(item.date).toLocaleDateString(),
            'Orders Processed': item.ordersProcessed,
            'Average Time (mins)': item.avgTimeMinutes.toFixed(1),
            'Total Time (mins)': (item.ordersProcessed * item.avgTimeMinutes).toFixed(1)
          }));
        }
        title = 'Picking_Efficiency_Report';
        break;
        
      default:
        console.error('Unknown report type:', reportType);
        return;
    }
    
    // Check if we have data to export
    if (data.length === 0) {
      alert('No data available to export');
      return;
    }
    
    // Use the exportData utility to generate and download the file
    import('@/lib/utils').then(utils => {
      utils.exportData(data, exportFormat, title);
    });
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
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => handleExport(document.querySelector('[data-state="active"][role="tab"]')?.getAttribute('value') || 'inventory')}
          >
            <i className="fas fa-download"></i>
            Export
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => window.print()}
          >
            <i className="fas fa-print"></i>
            Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <div className="overflow-x-auto pb-2">
          <TabsList className="w-full flex flex-nowrap min-w-max">
            <TabsTrigger value="inventory" className="flex-shrink-0">Inventory</TabsTrigger>
            <TabsTrigger value="orders" className="flex-shrink-0">Orders</TabsTrigger>
            <TabsTrigger value="categories" className="flex-shrink-0">Categories</TabsTrigger>
            <TabsTrigger value="value" className="flex-shrink-0">Value Analysis</TabsTrigger>
            <TabsTrigger value="efficiency" className="flex-shrink-0">Efficiency</TabsTrigger>
            <TabsTrigger value="call-logs" className="flex-shrink-0">Call Logs</TabsTrigger>
            <TabsTrigger value="customer-engagement" className="flex-shrink-0">Customer Engagement</TabsTrigger>
            <TabsTrigger value="order-quality" className="flex-shrink-0">Order Quality</TabsTrigger>
            <TabsTrigger value="predictions" className="flex-shrink-0">Predictions</TabsTrigger>
          </TabsList>
        </div>
        
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
        
        {/* Call Logs Tab */}
        <TabsContent value="call-logs" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Call Log Trends</CardTitle>
                  <CardDescription>
                    Call activity over time
                  </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {isLoadingCallLogs ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Loading call data...</p>
                  </div>
                ) : callLogsSummary?.trendData && callLogsSummary.trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={callLogsSummary.trendData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString();
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="Call Count"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No call data available for the selected period.</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4 w-full">
                <div className="rounded-lg bg-purple-50 p-4 border border-purple-200">
                  <p className="text-purple-600 text-sm font-medium">Total Calls</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {callLogsSummary?.totalCalls || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-200">
                  <p className="text-indigo-600 text-sm font-medium">Avg. Daily Calls</p>
                  <p className="text-2xl font-bold text-indigo-800">
                    {callLogsSummary?.trendData && callLogsSummary.trendData.length > 0 
                      ? (callLogsSummary.totalCalls / callLogsSummary.trendData.length).toFixed(1) 
                      : '0'}
                  </p>
                </div>
                <div className="rounded-lg bg-violet-50 p-4 border border-violet-200">
                  <p className="text-violet-600 text-sm font-medium">Call Types</p>
                  <p className="text-2xl font-bold text-violet-800">
                    {callLogsSummary?.callTypeData.length || 0}
                  </p>
                </div>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Call Types Distribution</CardTitle>
              <CardDescription>
                Breakdown of calls by type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoadingCallLogs ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Loading call data...</p>
                  </div>
                ) : callLogsSummary?.callTypeData && callLogsSummary.callTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callLogsSummary.callTypeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {callLogsSummary.callTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No call type data available.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Call Status Distribution</CardTitle>
              <CardDescription>
                Breakdown of calls by status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoadingCallLogs ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Loading call data...</p>
                  </div>
                ) : callLogsSummary?.callStatusData && callLogsSummary.callStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={callLogsSummary.callStatusData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" name="Call Count">
                        {callLogsSummary.callStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No call status data available.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Customer Engagement Tab */}
        <TabsContent value="customer-engagement" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Customer Engagement Segmentation</CardTitle>
              <CardDescription>
                Distribution of customers by engagement level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {isLoadingCustomerEngagement ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Loading customer engagement data...</p>
                  </div>
                ) : customerEngagement?.engagementSegments && customerEngagement.engagementSegments.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6 h-full">
                    <div className="flex flex-col justify-center">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={customerEngagement.engagementSegments}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={130}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            <Cell fill="#4ade80" /> {/* Active */}
                            <Cell fill="#fbbf24" /> {/* At Risk */}
                            <Cell fill="#ef4444" /> {/* Dormant */}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="space-y-6">
                        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                          <p className="text-emerald-600 text-sm font-medium">Active Customers (&lt; 30 days)</p>
                          <div className="mt-1 flex items-baseline justify-between">
                            <p className="text-2xl font-bold text-emerald-800">
                              {customerEngagement.engagementSegments[0]?.value || 0}
                            </p>
                            <p className="text-emerald-600">
                              {customerEngagement.totalCustomers > 0 
                                ? ((customerEngagement.engagementSegments[0]?.value || 0) / customerEngagement.totalCustomers * 100).toFixed(1) + '%'
                                : '0%'}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                          <p className="text-amber-600 text-sm font-medium">At Risk Customers (30-90 days)</p>
                          <div className="mt-1 flex items-baseline justify-between">
                            <p className="text-2xl font-bold text-amber-800">
                              {customerEngagement.engagementSegments[1]?.value || 0}
                            </p>
                            <p className="text-amber-600">
                              {customerEngagement.totalCustomers > 0 
                                ? ((customerEngagement.engagementSegments[1]?.value || 0) / customerEngagement.totalCustomers * 100).toFixed(1) + '%'
                                : '0%'}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                          <p className="text-red-600 text-sm font-medium">Dormant Customers (&gt; 90 days)</p>
                          <div className="mt-1 flex items-baseline justify-between">
                            <p className="text-2xl font-bold text-red-800">
                              {customerEngagement.engagementSegments[2]?.value || 0}
                            </p>
                            <p className="text-red-600">
                              {customerEngagement.totalCustomers > 0 
                                ? ((customerEngagement.engagementSegments[2]?.value || 0) / customerEngagement.totalCustomers * 100).toFixed(1) + '%'
                                : '0%'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No customer engagement data available.</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4 w-full">
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <p className="text-blue-600 text-sm font-medium">Total Customers</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {customerEngagement?.totalCustomers || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-purple-50 p-4 border border-purple-200">
                  <p className="text-purple-600 text-sm font-medium">Total Interactions</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {customerEngagement?.totalInteractions || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-200">
                  <p className="text-indigo-600 text-sm font-medium">Avg. Calls/Customer</p>
                  <p className="text-2xl font-bold text-indigo-800">
                    {customerEngagement?.avgCallsPerCustomer.toFixed(1) || '0.0'}
                  </p>
                </div>
              </div>
            </CardFooter>
          </Card>

          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Top Engaged Customers</CardTitle>
              <CardDescription>
                Customers with highest interaction count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCustomerEngagement ? (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-muted-foreground">Loading customer data...</p>
                </div>
              ) : customerEngagement?.topEngagedCustomers && customerEngagement.topEngagedCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border divide-y">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                        <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Call Count</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Interaction</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Days Since Last Call</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {customerEngagement.topEngagedCustomers.map((customer) => (
                        <tr key={customer.id}>
                          <td className="py-2 px-4">{customer.name}</td>
                          <td className="py-2 px-4 text-center">{customer.callCount}</td>
                          <td className="py-2 px-4 text-right">
                            {customer.lastInteractionDate 
                              ? new Date(customer.lastInteractionDate).toLocaleDateString() 
                              : 'Never'}
                          </td>
                          <td className={`py-2 px-4 text-right ${
                            customer.daysSinceLastInteraction === null ? 'text-gray-400' :
                            customer.daysSinceLastInteraction < 30 ? 'text-emerald-600' :
                            customer.daysSinceLastInteraction < 90 ? 'text-amber-600' :
                            'text-red-600'
                          }`}>
                            {customer.daysSinceLastInteraction === null ? 'N/A' : customer.daysSinceLastInteraction}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-muted-foreground">No customer engagement data available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Order Quality Tab */}
        <TabsContent value="order-quality" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Order Error Rate Trends</CardTitle>
                  <CardDescription>
                    Order quality metrics over time
                  </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {isLoadingOrderQuality ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Loading order quality data...</p>
                  </div>
                ) : orderQualitySummary?.trending && orderQualitySummary.trending.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={orderQualitySummary.trending}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip 
                        formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Error Rate']}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString();
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="errorRate"
                        name="Error Rate"
                        stroke="#ef4444"
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No order quality data available for the selected period.</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="grid grid-cols-4 gap-4 w-full">
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <p className="text-blue-600 text-sm font-medium">Shipped Orders</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {orderQualitySummary?.totalShippedOrders || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <p className="text-red-600 text-sm font-medium">Total Errors</p>
                  <p className="text-2xl font-bold text-red-800">
                    {orderQualitySummary?.totalErrorsInPeriod || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                  <p className="text-amber-600 text-sm font-medium">Error Rate</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {orderQualitySummary?.errorRate.toFixed(2) || '0.00'}%
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                  <p className="text-emerald-600 text-sm font-medium">Resolution Rate</p>
                  <p className="text-2xl font-bold text-emerald-800">
                    {orderQualitySummary?.resolutionRate.toFixed(1) || '0.0'}%
                  </p>
                </div>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Types Distribution</CardTitle>
              <CardDescription>
                Breakdown of errors by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoadingOrderQuality ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Loading error data...</p>
                  </div>
                ) : orderQualitySummary?.errorsByType && orderQualitySummary.errorsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderQualitySummary.errorsByType}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {orderQualitySummary.errorsByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No error type data available.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Resolution Metrics</CardTitle>
              <CardDescription>
                Key performance indicators for error resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Error Resolution Time</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Average Days to Resolve:</span>
                    <span className="text-lg font-bold">
                      {orderQualitySummary?.avgResolutionTimeInDays 
                        ? orderQualitySummary.avgResolutionTimeInDays.toFixed(1) + ' days'
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-2">Status of Reported Errors</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded border">
                        <p className="text-emerald-600 text-sm font-medium">Resolved</p>
                        <p className="text-2xl font-bold text-emerald-800">
                          {orderQualitySummary?.resolvedErrorsCount || 0}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded border">
                        <p className="text-red-600 text-sm font-medium">Unresolved</p>
                        <p className="text-2xl font-bold text-red-800">
                          {orderQualitySummary?.unresolvedErrorsCount || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {orderQualitySummary?.rootCauseAnalysis && Object.keys(orderQualitySummary.rootCauseAnalysis).length > 0 && (
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Common Root Causes</h3>
                    <div className="space-y-2">
                      {Object.entries(orderQualitySummary.rootCauseAnalysis)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([cause, count], index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm truncate max-w-[70%]">{cause}</span>
                            <span className="text-sm font-medium">{count} issues</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Predictions Tab */}
        <TabsContent value="predictions" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Inventory Prediction Overview</CardTitle>
                  <CardDescription>
                    Products requiring reorder and predicted stockout dates
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select defaultValue="moving_average" onValueChange={(method) => {
                    if (window.confirm(`Generate new predictions using ${method} method?`)) {
                      fetch(`/api/inventory-predictions/generate?method=${method}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      }).then(() => {
                        window.location.reload();
                      });
                    }
                  }}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Prediction Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moving_average">Moving Average</SelectItem>
                      <SelectItem value="linear_regression">Linear Regression</SelectItem>
                      <SelectItem value="seasonal_adjustment">Seasonal Adjustment</SelectItem>
                      <SelectItem value="weighted_average">Weighted Average</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => {
                    window.location.reload();
                  }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Predicted Demand</TableHead>
                      <TableHead>Stockout Date</TableHead>
                      <TableHead>Recommended Reorder Date</TableHead>
                      <TableHead>Recommended Quantity</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsRequiringReorder.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                          No products requiring reorder at this time
                        </TableCell>
                      </TableRow>
                    ) : (
                      productsRequiringReorder.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            <Badge variant={item.currentStock === 0 ? "destructive" : item.currentStock < 10 ? "outline" : "default"}>
                              {item.currentStock}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.predictedDemand} units</TableCell>
                          <TableCell>
                            {item.predictedStockoutDate ? 
                              new Date(item.predictedStockoutDate).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {item.recommendedReorderDate ? 
                              new Date(item.recommendedReorderDate).toLocaleDateString() : 'ASAP'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50">
                              {item.recommendedQuantity || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                item.accuracy === 'high' ? 'default' :
                                item.accuracy === 'medium' ? 'outline' : 'destructive'
                              }
                              className={
                                item.accuracy === 'high' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                                item.accuracy === 'medium' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : ''
                              }
                            >
                              {item.confidenceLevel}% ({item.accuracy})
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prediction Methods Distribution</CardTitle>
              <CardDescription>
                Breakdown of prediction methods used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={predictionMethodsDistribution}
                      dataKey="count"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#82ca9d"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {predictionMethodsDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prediction Accuracy</CardTitle>
              <CardDescription>
                Confidence level distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={predictionAccuracyDistribution}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, 'Count']} />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6">
                      {predictionAccuracyDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.name === 'High' ? '#4ade80' : 
                            entry.name === 'Medium' ? '#fbbf24' : '#ef4444'
                          } 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;