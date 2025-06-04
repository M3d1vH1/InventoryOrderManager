import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Activity, 
  Clock, 
  MemoryStick,
  Server,
  Wifi,
  AlertCircle
} from "lucide-react";

interface HealthCheckDependency {
  status: string;
  responseTime?: number;
  error?: string;
  usage?: {
    used: number;
    total: number;
    percentage: number;
  };
  seconds?: number;
  formatted?: string;
}

interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  message: string;
  dependencies: {
    database: HealthCheckDependency;
    memory: HealthCheckDependency;
    uptime: HealthCheckDependency;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export default function HealthCheck() {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { toast } = useToast();

  const performHealthCheck = async () => {
    setIsLoading(true);
    try {
      const result = await apiRequest<HealthCheckResult>('/api/health');
      setHealthData(result);
      setLastChecked(new Date());
      
      toast({
        title: "Health Check Complete",
        description: `System status: ${result.overall}`,
        variant: result.overall === 'unhealthy' ? 'destructive' : 'default'
      });
    } catch (error: any) {
      toast({
        title: "Health Check Failed",
        description: error.message || 'Unable to perform health check',
        variant: "destructive"
      });
      
      // Set fallback error state
      setHealthData({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Health check system unavailable',
        dependencies: {
          database: { status: 'error', error: 'Unable to check' },
          memory: { status: 'error', error: 'Unable to check' },
          uptime: { status: 'error', error: 'Unable to check' }
        },
        overall: 'unhealthy'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(performHealthCheck, 30000); // 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Initial load
  useEffect(() => {
    performHealthCheck();
  }, []);

  const getStatusIcon = (status?: string) => {
    if (!status) return <AlertCircle className="h-4 w-4 text-gray-500" />;
    
    switch (status) {
      case 'connected':
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
      case 'disconnected':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return 'outline';
    
    switch (status) {
      case 'connected':
      case 'ok':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
      case 'disconnected':
      case 'critical':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getOverallStatusColor = (overall?: string) => {
    if (!overall) return 'text-gray-600 bg-gray-50 border-gray-200';
    
    switch (overall) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">System Health Monitor</h3>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of critical system dependencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-500' : ''}`} />
            Auto Refresh {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button
            onClick={performHealthCheck}
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Check Now
          </Button>
        </div>
      </div>

      {isLoading && !healthData && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Performing Health Check</AlertTitle>
          <AlertDescription>
            Checking system dependencies and status...
          </AlertDescription>
        </Alert>
      )}

      {healthData && (
        <>
          {/* Overall Status */}
          <Alert className={getOverallStatusColor(healthData.overall)}>
            <Server className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              System Status: {healthData.overall ? healthData.overall.charAt(0).toUpperCase() + healthData.overall.slice(1) : 'Unknown'}
              {getStatusIcon(healthData.overall)}
            </AlertTitle>
            <AlertDescription>
              {healthData.message || 'No status message available'}
              {lastChecked && (
                <span className="block text-xs mt-1">
                  Last checked: {lastChecked.toLocaleString()}
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Dependencies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  {getStatusIcon(healthData.dependencies?.database?.status)}
                  <Badge variant={getStatusBadgeVariant(healthData.dependencies?.database?.status)}>
                    {healthData.dependencies?.database?.status || 'unknown'}
                  </Badge>
                </div>
                
                {healthData.dependencies?.database?.responseTime && (
                  <div className="text-xs text-muted-foreground">
                    Response time: {healthData.dependencies.database.responseTime}ms
                  </div>
                )}
                
                {healthData.dependencies?.database?.error && (
                  <div className="text-xs text-red-600 mt-1">
                    {healthData.dependencies.database.error}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Memory Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  {getStatusIcon(healthData.dependencies?.memory?.status)}
                  <Badge variant={getStatusBadgeVariant(healthData.dependencies?.memory?.status)}>
                    {healthData.dependencies?.memory?.status || 'unknown'}
                  </Badge>
                </div>
                
                {healthData.dependencies?.memory?.usage && (
                  <div className="space-y-2">
                    <Progress 
                      value={healthData.dependencies.memory.usage.percentage || 0} 
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground">
                      {healthData.dependencies.memory.usage.used || 0}MB / {healthData.dependencies.memory.usage.total || 0}MB
                      ({healthData.dependencies.memory.usage.percentage || 0}%)
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Uptime Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  {getStatusIcon(healthData.dependencies?.uptime?.status)}
                  <Badge variant={getStatusBadgeVariant(healthData.dependencies?.uptime?.status)}>
                    {healthData.dependencies?.uptime?.status || 'unknown'}
                  </Badge>
                </div>
                
                {healthData.dependencies?.uptime?.formatted && (
                  <div className="text-xs text-muted-foreground">
                    {healthData.dependencies.uptime.formatted}
                  </div>
                )}
                
                {healthData.dependencies?.uptime?.seconds && (
                  <div className="text-xs text-muted-foreground">
                    ({healthData.dependencies.uptime.seconds} seconds)
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Health Check Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Health Check Details</CardTitle>
              <CardDescription>
                Detailed information about the last health check
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span> {healthData.status}
                </div>
                <div>
                  <span className="font-medium">Timestamp:</span> {new Date(healthData.timestamp).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Overall Health:</span> {healthData.overall}
                </div>
                <div>
                  <span className="font-medium">Auto Refresh:</span> {autoRefresh ? 'Enabled (30s)' : 'Disabled'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endpoint Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Health Check Endpoints</CardTitle>
              <CardDescription>
                Available endpoints for health monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <code className="bg-slate-100 px-2 py-1 rounded text-xs">/health</code>
                  <span className="text-muted-foreground">- Public health check endpoint</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <code className="bg-slate-100 px-2 py-1 rounded text-xs">/api/health</code>
                  <span className="text-muted-foreground">- Authenticated health check endpoint</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}