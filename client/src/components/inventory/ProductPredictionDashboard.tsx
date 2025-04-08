import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addMonths, startOfMonth } from 'date-fns';
import { el } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  AlertCircle,
  Package,
  Layers,
  Clock,
  ArrowLeft,
  RefreshCcw,
  Plus
} from 'lucide-react';

interface ProductPredictionDashboardProps {
  productId: number;
  onBack: () => void;
}

interface Prediction {
  id: number;
  productId: number;
  productName: string;
  generatedAt: string;
  predictionMethod: string;
  predictedDemand: number;
  confidenceLevel: number;
  accuracy: 'high' | 'medium' | 'low';
  predictedStockoutDate: string | null;
  recommendedReorderDate: string | null;
  recommendedQuantity: number | null;
  notes: string | null;
  createdById: number | null;
  updatedAt: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  currentStock: number;
  minStockLevel: number;
  imageUrl: string | null;
  createdAt: string;
  categoryId: number | null;
  imagePath: string | null;
}

interface InventoryChange {
  id: number;
  productId: number;
  productName: string;
  changeDate: string;
  quantity: number;
  changeType: string;
  notes: string | null;
  userId: number | null;
  userName: string | null;
}

// Generate forecast data for the next 6 months based on latest prediction
const generateForecastData = (prediction: Prediction | null, product: Product | null) => {
  if (!prediction || !product) return [];
  
  const data = [];
  try {
    const today = new Date();
    if (isNaN(today.getTime())) {
      console.error('Invalid date for forecast generation');
      return [];
    }
    
    const dailyRate = prediction.predictedDemand / 30; // Assuming monthly demand
    let currentStock = product.currentStock;
    
    // Generate data for each month
    for (let i = 0; i < 6; i++) {
      try {
        const month = addMonths(startOfMonth(today), i);
        const monthDemand = Math.round(prediction.predictedDemand * (i === 0 ? 0.5 : 1)); // Half for current month
        currentStock = Math.max(0, currentStock - monthDemand);
        
        data.push({
          month: format(month, 'MMM yyyy'),
          projectedStock: currentStock,
          predictedDemand: monthDemand,
          stockThreshold: product.minStockLevel,
        });
      } catch (e) {
        console.error('Error generating forecast for month', i, e);
        // Continue with next month
      }
    }
  } catch (e) {
    console.error('Error in forecast generation:', e);
  }
  
  return data;
};

// Function to get the appropriate method name translation key
const getMethodTranslationKey = (method: string): string => {
  switch (method) {
    case 'moving_average': return 'movingAverage';
    case 'linear_regression': return 'linearRegression';
    case 'seasonal_adjustment': return 'seasonalAdjustment';
    case 'weighted_average': return 'weightedAverage';
    default: return 'manual';
  }
};

const ProductPredictionDashboard: React.FC<ProductPredictionDashboardProps> = ({ productId, onBack }) => {
  const { t, i18n } = useTranslation();
  const [product, setProduct] = useState<Product | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        } else {
          console.error('Failed to fetch product');
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchPredictions = async () => {
      try {
        const response = await fetch(`/api/inventory-predictions?productId=${productId}`);
        if (response.ok) {
          const data = await response.json();
          setPredictions(data);
        } else {
          console.error('Failed to fetch predictions');
        }
      } catch (error) {
        console.error('Error fetching predictions:', error);
      }
    };
    
    const fetchInventoryHistory = async () => {
      try {
        setLoadingHistory(true);
        const response = await fetch(`/api/inventory-changes?productId=${productId}`);
        if (response.ok) {
          const data = await response.json();
          setInventoryHistory(data);
        } else {
          console.error('Failed to fetch inventory history');
        }
      } catch (error) {
        console.error('Error fetching inventory history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    fetchProduct();
    fetchPredictions();
    fetchInventoryHistory();
  }, [productId]);
  
  // Get the latest prediction
  const latestPrediction = predictions.length > 0 ? predictions[0] : null;
  
  // Prepare forecast data
  const forecastData = generateForecastData(latestPrediction, product);
  
  // Prepare inventory history data for chart
  const inventoryHistoryData = inventoryHistory.map(change => {
    try {
      return {
        date: format(new Date(change.changeDate), 'dd/MM/yyyy'),
        quantity: change.quantity,
        type: change.changeType
      };
    } catch (e) {
      console.error('Invalid date:', change.changeDate);
      return {
        date: 'Invalid Date',
        quantity: change.quantity,
        type: change.changeType
      };
    }
  }).slice(0, 20); // Limit to last 20 changes
  
  // Get confidence level color
  const getConfidenceLevelColor = (level: number) => {
    if (level >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (level >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (level >= 40) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };
  
  // Get accuracy badge color
  const getAccuracyBadgeColor = (accuracy: string) => {
    switch (accuracy) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };
  
  // Format date based on locale
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    
    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date format:', dateStr);
        return '—';
      }
      return format(date, 'PP', { locale: i18n.language === 'el' ? el : undefined });
    } catch (e) {
      console.error('Error formatting date:', e);
      return '—';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Page Header with Back Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold">
            {product ? product.name : <Skeleton className="h-8 w-[200px]" />}
          </h1>
          {product && (
            <Badge variant="outline" className="ml-2">
              {t('inventory.sku')}: {product.sku}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Product Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('inventory.currentStock')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-baseline">
                <span className="text-3xl font-bold">{product?.currentStock}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {t('inventory.minLevel')}: {product?.minStockLevel}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('inventoryPredictions.predictedDemand')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !latestPrediction ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-baseline">
                <span className="text-3xl font-bold">{latestPrediction.predictedDemand}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {t('inventoryPredictions.methods.' + getMethodTranslationKey(latestPrediction.predictionMethod))}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('inventoryPredictions.predictedStockoutDate')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !latestPrediction ? (
              <Skeleton className="h-10 w-[150px]" />
            ) : (
              <div className="flex items-baseline">
                <span className="text-3xl font-bold">
                  {latestPrediction.predictedStockoutDate ? formatDate(latestPrediction.predictedStockoutDate) : '—'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('inventoryPredictions.sixMonthForecast')}</CardTitle>
          <CardDescription>
            {t('inventoryPredictions.forecastDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !latestPrediction ? (
            <div className="h-[300px] flex items-center justify-center">
              <Skeleton className="h-[250px] w-full" />
            </div>
          ) : forecastData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={forecastData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => {
                      const translatedName = name === 'projectedStock' 
                        ? t('inventoryPredictions.projectedStock')
                        : name === 'predictedDemand'
                          ? t('inventoryPredictions.predictedDemand')
                          : t('inventory.minLevel');
                      return [value, translatedName];
                    }}
                  />
                  <Legend 
                    formatter={(value) => {
                      return value === 'projectedStock' 
                        ? t('inventoryPredictions.projectedStock')
                        : value === 'predictedDemand'
                          ? t('inventoryPredictions.predictedDemand')
                          : t('inventory.minLevel');
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projectedStock" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    activeDot={{ r: 8 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="predictedDemand" 
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                  />
                  <Line
                    type="monotone"
                    dataKey="stockThreshold"
                    stroke="#ff7300"
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t('inventoryPredictions.noDataAvailable')}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Prediction Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('inventoryPredictions.predictionDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !latestPrediction ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">{t('inventoryPredictions.predictionMethod')}</h3>
                  <p>{t(`inventoryPredictions.methods.${getMethodTranslationKey(latestPrediction.predictionMethod)}`)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium">{t('inventoryPredictions.confidence')}</h3>
                  <Badge 
                    variant="outline" 
                    className={getConfidenceLevelColor(latestPrediction.confidenceLevel)}
                  >
                    {latestPrediction.confidenceLevel}%
                  </Badge>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium">{t('inventoryPredictions.accuracy')}</h3>
                  <Badge 
                    variant="outline" 
                    className={getAccuracyBadgeColor(latestPrediction.accuracy)}
                  >
                    {t(`inventoryPredictions.accuracyLevels.${latestPrediction.accuracy}`)}
                  </Badge>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium">{t('inventoryPredictions.generatedAt')}</h3>
                  <p>{formatDate(latestPrediction.generatedAt)}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">{t('inventoryPredictions.recommendedReorderDate')}</h3>
                  <p>{latestPrediction.recommendedReorderDate ? formatDate(latestPrediction.recommendedReorderDate) : '—'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium">{t('inventoryPredictions.recommendedQuantity')}</h3>
                  <p>{latestPrediction.recommendedQuantity || '—'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium">{t('common.notes')}</h3>
                  <p className="text-sm text-muted-foreground">{latestPrediction.notes || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Inventory History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="h-[250px] flex items-center justify-center">
              <Skeleton className="h-[200px] w-full" />
            </div>
          ) : inventoryHistoryData.length > 0 ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => {
                      return [value, t('inventory.quantity')];
                    }}
                  />
                  <Legend formatter={() => t('inventory.quantityChanges')} />
                  <Bar dataKey="quantity" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {t('inventory.noHistoryAvailable')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductPredictionDashboard;