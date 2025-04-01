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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, FileDown, FileText } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<string>("inventory");
  
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

  // Get tag distribution data for charts
  const { data: tagsData = [], isLoading: isLoadingTags } = useQuery<CategoryItem[]>({
    queryKey: ['/api/analytics/product-tags'],
  });
  
  // Keep this for backwards compatibility but it will be removed later
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
        
      case 'tags':
        // Prepare tag data for export
        if (tagsData.length > 0) {
          data = tagsData.map(tag => ({
            Tag: tag.name,
            'Product Count': tag.value,
            'Percentage': ((tag.value / tagsData.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(1) + '%'
          }));
        }
        title = 'Tags_Report';
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
            onClick={() => handleExport(activeTab)}
          >
            <FileDown className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => window.print()}
          >
            <FileText className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-6">
          <div className="flex items-center pb-4">
            <span className="text-sm font-medium mr-4">Time Range:</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last Month</SelectItem>
                <SelectItem value="3">Last 3 Months</SelectItem>
                <SelectItem value="6">Last 6 Months</SelectItem>
                <SelectItem value="12">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <Card className={`cursor-pointer border-2 transition-all hover:shadow-md ${
              ['inventory', 'tags', 'predictions'].includes(activeTab) 
                ? 'border-primary' : 'border-transparent'
            }`} onClick={() => setActiveTab('inventory')}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg">Inventory Reports</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant={activeTab === "inventory" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("inventory")}
                  >
                    Overview
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "tags" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("tags")}
                  >
                    Tags Analysis
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "predictions" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("predictions")}
                  >
                    Stock Predictions
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={`cursor-pointer border-2 transition-all hover:shadow-md ${
              ['orders', 'dispatch-schedule', 'shipping-delays', 'fulfillment-stats', 'efficiency'].includes(activeTab) 
                ? 'border-primary' : 'border-transparent'
            }`} onClick={() => setActiveTab('orders')}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg">Order Reports</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant={activeTab === "orders" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("orders")}
                  >
                    Overview
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "efficiency" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("efficiency")}
                  >
                    Efficiency
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "dispatch-schedule" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("dispatch-schedule")}
                  >
                    Dispatch
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "shipping-delays" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("shipping-delays")}
                  >
                    Delays
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "fulfillment-stats" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("fulfillment-stats")}
                  >
                    Fulfillment
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={`cursor-pointer border-2 transition-all hover:shadow-md ${
              ['call-logs', 'customer-engagement', 'order-quality'].includes(activeTab) 
                ? 'border-primary' : 'border-transparent'
            }`} onClick={() => setActiveTab('call-logs')}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg">Call Center Reports</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant={activeTab === "call-logs" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("call-logs")}
                  >
                    Call Logs
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "customer-engagement" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("customer-engagement")}
                  >
                    Engagement
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeTab === "order-quality" ? "default" : "outline"} 
                    className="text-sm" 
                    onClick={() => setActiveTab("order-quality")}
                  >
                    Quality Issues
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* PDF Report Content Sections */}
        {activeTab === "dispatch-schedule" && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Dispatch Schedule Report</CardTitle>
                    <CardDescription>
                      View upcoming and recent order dispatches
                    </CardDescription>
                  </div>
                  <Button 
                    variant="default" 
                    className="flex items-center gap-2"
                    onClick={() => window.open('/api/reports/dispatch-schedule/pdf', '_blank')}
                  >
                    <FileDown className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  The Dispatch Schedule Report provides a complete overview of orders that are scheduled for dispatch, 
                  including order details, customer information, and shipping method.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-blue-700 font-medium text-sm">What's in this report?</h4>
                  <ul className="mt-2 text-blue-700 text-sm list-disc pl-5 space-y-1">
                    <li>Order numbers and customer names</li>
                    <li>Order dates and estimated shipping dates</li>
                    <li>Current order status</li>
                    <li>Shipping carrier information</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {activeTab === "shipping-delays" && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Shipping Delays Report</CardTitle>
                    <CardDescription>
                      Monitor delayed shipments and contact information
                    </CardDescription>
                  </div>
                  <Button 
                    variant="default" 
                    className="flex items-center gap-2"
                    onClick={() => window.open('/api/reports/shipping-delays/pdf', '_blank')}
                  >
                    <FileDown className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  The Shipping Delays Report highlights orders that are past their estimated shipping date and 
                  provides customer contact information to facilitate communication about delays.
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <h4 className="text-amber-700 font-medium text-sm">What's in this report?</h4>
                  <ul className="mt-2 text-amber-700 text-sm list-disc pl-5 space-y-1">
                    <li>Delayed order information</li>
                    <li>Days of delay for each order</li>
                    <li>Customer contact details</li>
                    <li>Order status and estimated shipping dates</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {activeTab === "fulfillment-stats" && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Fulfillment Statistics Report</CardTitle>
                    <CardDescription>
                      Analyze order fulfillment performance and metrics
                    </CardDescription>
                  </div>
                  <Button 
                    variant="default" 
                    className="flex items-center gap-2"
                    onClick={() => window.open('/api/reports/fulfillment-stats/pdf', '_blank')}
                  >
                    <FileDown className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  The Fulfillment Statistics Report provides a comprehensive analysis of your order fulfillment 
                  performance, including metrics on shipping times, order statuses, and fulfillment efficiency.
                </p>
                
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
                  <h4 className="text-emerald-700 font-medium text-sm">What's in this report?</h4>
                  <ul className="mt-2 text-emerald-700 text-sm list-disc pl-5 space-y-1">
                    <li>Order volume and status breakdown</li>
                    <li>Average fulfillment time analysis</li>
                    <li>Fulfillment efficiency metrics</li>
                    <li>Trends in shipping performance</li>
                    <li>Partial fulfillment statistics</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
          </div>
        )}
        
        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                          { 
                            name: 'Pending', 
                            value: orders?.filter(o => o.status === 'pending').length || 0 
                          },
                          { 
                            name: 'Picked', 
                            value: orders?.filter(o => o.status === 'picked').length || 0 
                          },
                          { 
                            name: 'Shipped', 
                            value: orders?.filter(o => o.status === 'shipped').length || 0 
                          },
                          { 
                            name: 'Cancelled', 
                            value: orders?.filter(o => o.status === 'cancelled').length || 0 
                          },
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
                <CardTitle>Order Volume Trend</CardTitle>
                <CardDescription>
                  Monthly order volume
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
                        dataKey="pending" 
                        stroke="#fbbf24" 
                        name="Pending"
                        dot={{ r: 4 }}
                        activeDot={{ r: 8 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="shipped" 
                        stroke="#4ade80" 
                        name="Shipped"
                        dot={{ r: 4 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tags Analysis */}
        {activeTab === "tags" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Product Tags Distribution</CardTitle>
                <CardDescription>
                  Breakdown of products by tags
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tagsData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8b5cf6">
                        {tagsData.map((entry, index) => (
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
                <CardTitle>Popular Tags</CardTitle>
                <CardDescription>
                  Most frequently used product tags
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tagsData.slice(0, 5)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {tagsData.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
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
                <CardTitle>Tags Performance</CardTitle>
                <CardDescription>
                  Average sales by product tag
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tag Name</TableHead>
                        <TableHead>Product Count</TableHead>
                        <TableHead>% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tagsData.slice(0, 10).map((tag) => (
                        <TableRow key={tag.name}>
                          <TableCell>{tag.name}</TableCell>
                          <TableCell>{tag.value}</TableCell>
                          <TableCell>
                            {((tag.value / tagsData.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Efficiency Tab */}
        {activeTab === "efficiency" && pickingEfficiency && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Picking Efficiency Over Time</CardTitle>
                <CardDescription>
                  Average picking time per order (in minutes)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={pickingEfficiency.pickingEfficiency}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="avgTimeMinutes" 
                        stroke="#3b82f6" 
                        name="Avg. Time (mins)"
                        dot={{ r: 4 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200 w-full">
                  <p className="text-blue-600 text-sm font-medium">Overall Average Picking Time</p>
                  <p className="text-3xl font-bold text-blue-800">
                    {pickingEfficiency.averagePickingTimeMinutes.toFixed(1)} minutes
                  </p>
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders Processed per Day</CardTitle>
                <CardDescription>
                  Daily order processing volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={pickingEfficiency.pickingEfficiency}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="ordersProcessed" fill="#4ade80" name="Orders Processed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Efficiency Metrics</CardTitle>
                <CardDescription>
                  Detailed picking efficiency statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Avg. Time (mins)</TableHead>
                        <TableHead>Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pickingEfficiency.pickingEfficiency.map((item) => (
                        <TableRow key={item.date}>
                          <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                          <TableCell>{item.ordersProcessed}</TableCell>
                          <TableCell>{item.avgTimeMinutes.toFixed(1)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                item.avgTimeMinutes < pickingEfficiency.averagePickingTimeMinutes * 0.8
                                  ? "success"
                                  : item.avgTimeMinutes > pickingEfficiency.averagePickingTimeMinutes * 1.2
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {
                                item.avgTimeMinutes < pickingEfficiency.averagePickingTimeMinutes * 0.8
                                  ? "Excellent"
                                  : item.avgTimeMinutes > pickingEfficiency.averagePickingTimeMinutes * 1.2
                                  ? "Needs Improvement"
                                  : "Good"
                              }
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Call Logs Tab */}
        {activeTab === "call-logs" && callLogsSummary && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Call Logs Trend</CardTitle>
                    <CardDescription>
                      Call volume over time
                    </CardDescription>
                  </div>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Time Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={callLogsSummary.trendData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#8b5cf6" 
                        name="Call Count"
                        dot={{ r: 4 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="rounded-lg bg-violet-50 p-4 border border-violet-200 w-full">
                  <p className="text-violet-600 text-sm font-medium">Total Calls Logged</p>
                  <p className="text-3xl font-bold text-violet-800">
                    {callLogsSummary.totalCalls}
                  </p>
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Types Distribution</CardTitle>
                <CardDescription>
                  Breakdown by call purpose/type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Status Distribution</CardTitle>
                <CardDescription>
                  Breakdown by call resolution status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callLogsSummary.callStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {callLogsSummary.callStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Customer Engagement Tab */}
        {activeTab === "customer-engagement" && customerEngagement && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Customer Engagement Summary</CardTitle>
                <CardDescription>
                  Overview of customer interaction metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                    <p className="text-blue-600 text-sm font-medium">Total Customers</p>
                    <p className="text-3xl font-bold text-blue-800">
                      {customerEngagement.totalCustomers}
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4 border border-purple-200">
                    <p className="text-purple-600 text-sm font-medium">Total Interactions</p>
                    <p className="text-3xl font-bold text-purple-800">
                      {customerEngagement.totalInteractions}
                    </p>
                  </div>
                  <div className="rounded-lg bg-teal-50 p-4 border border-teal-200">
                    <p className="text-teal-600 text-sm font-medium">Avg. Calls Per Customer</p>
                    <p className="text-3xl font-bold text-teal-800">
                      {customerEngagement.avgCallsPerCustomer.toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Engagement Segments</CardTitle>
                <CardDescription>
                  Breakdown of customer interaction frequency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={customerEngagement.engagementSegments}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {customerEngagement.engagementSegments.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
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
                <CardTitle>Top Engaged Customers</CardTitle>
                <CardDescription>
                  Customers with highest interaction frequency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Call Count</TableHead>
                        <TableHead>Last Interaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerEngagement.topEngagedCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>{customer.name}</TableCell>
                          <TableCell>{customer.callCount}</TableCell>
                          <TableCell>
                            {customer.lastInteractionDate 
                              ? new Date(customer.lastInteractionDate).toLocaleDateString()
                              : 'N/A'}
                            {customer.daysSinceLastInteraction !== null && (
                              <Badge className="ml-2" variant="outline">
                                {customer.daysSinceLastInteraction} days ago
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Order Quality Tab */}
        {activeTab === "order-quality" && orderQualitySummary && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Order Error Rate Trend</CardTitle>
                    <CardDescription>
                      Error rate over time
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={orderQualitySummary.trending}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis 
                        tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                      />
                      <Tooltip 
                        formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Error Rate']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="errorRate" 
                        stroke="#ef4444" 
                        name="Error Rate"
                        dot={{ r: 4 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                    <p className="text-red-600 text-sm font-medium">Error Rate</p>
                    <p className="text-2xl font-bold text-red-800">
                      {(orderQualitySummary.errorRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                    <p className="text-amber-600 text-sm font-medium">Total Errors</p>
                    <p className="text-2xl font-bold text-amber-800">
                      {orderQualitySummary.totalErrors}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                    <p className="text-emerald-600 text-sm font-medium">Resolution Rate</p>
                    <p className="text-2xl font-bold text-emerald-800">
                      {(orderQualitySummary.resolutionRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                    <p className="text-blue-600 text-sm font-medium">Avg. Resolution Time</p>
                    <p className="text-2xl font-bold text-blue-800">
                      {orderQualitySummary.avgResolutionTimeInDays.toFixed(1)} days
                    </p>
                  </div>
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Errors by Type</CardTitle>
                <CardDescription>
                  Breakdown of error types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Root Cause Analysis</CardTitle>
                <CardDescription>
                  Common causes of order errors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={Object.entries(orderQualitySummary.rootCauseAnalysis)
                        .map(([name, value]) => ({ name, value }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={150} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f97316" name="Count">
                        {Object.entries(orderQualitySummary.rootCauseAnalysis)
                          .map(([name, value], index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === "predictions" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Products Requiring Reorder</CardTitle>
                    <CardDescription>
                      Items predicted to require reordering
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/inventory-predictions'}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Generate New Predictions
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPredictions ? (
                  <div className="py-6 text-center">Loading prediction data...</div>
                ) : isReorderError ? (
                  <div className="py-6 text-center text-red-500">
                    Error loading prediction data: {reorderError?.toString()}
                  </div>
                ) : productsRequiringReorder.length === 0 ? (
                  <div className="py-6 text-center">No products currently require reordering</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Predicted Demand</TableHead>
                          <TableHead>Recom. Quantity</TableHead>
                          <TableHead>Recom. Date</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsRequiringReorder.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.currentStock}</TableCell>
                            <TableCell>{item.predictedDemand}</TableCell>
                            <TableCell>{item.recommendedQuantity}</TableCell>
                            <TableCell>
                              {item.recommendedReorderDate ? 
                                new Date(item.recommendedReorderDate).toLocaleDateString() : 
                                'ASAP'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.accuracy === 'high' ? 'success' : 
                                  item.accuracy === 'medium' ? 'default' : 
                                  'destructive'
                                }
                              >
                                {item.accuracy.charAt(0).toUpperCase() + item.accuracy.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prediction Methods</CardTitle>
                <CardDescription>
                  Distribution of prediction algorithms used
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
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {predictionMethodsDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [value, props.payload.method]} />
                      <Legend formatter={(value, entry) => entry.payload.method} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prediction Accuracy</CardTitle>
                <CardDescription>
                  Distribution of confidence levels
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
                      <Tooltip />
                      <Bar dataKey="count" name="Count">
                        <Cell fill="#4ade80" />  {/* High */}
                        <Cell fill="#fbbf24" />  {/* Medium */}
                        <Cell fill="#ef4444" />  {/* Low */}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;