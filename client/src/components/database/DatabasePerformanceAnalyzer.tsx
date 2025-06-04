import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface IndexUsageStats {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexScans: number;
  tuplesRead: number;
  tuplesFetched: number;
  indexSize: string;
  isUnused: boolean;
}

interface TableStats {
  tableName: string;
  rowCount: number;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  lastVacuum: Date | null;
  lastAnalyze: Date | null;
}

interface DatabaseHealth {
  indexHealth: IndexUsageStats[];
  tableHealth: TableStats[];
  recommendations: string[];
  benchmarks: Record<string, number>;
  slowQueries: any[];
}

const DatabasePerformanceAnalyzer = () => {
  const [analysisResults, setAnalysisResults] = useState<DatabaseHealth | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runDatabaseAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      // Simulate database analysis with mock data for demonstration
      const mockResults: DatabaseHealth = {
        indexHealth: [
          { schemaName: 'public', tableName: 'products', indexName: 'idx_products_sku', indexScans: 15420, tuplesRead: 15420, tuplesFetched: 15420, indexSize: '2048 kB', isUnused: false },
          { schemaName: 'public', tableName: 'orders', indexName: 'idx_orders_status', indexScans: 8950, tuplesRead: 12300, tuplesFetched: 8950, indexSize: '1024 kB', isUnused: false },
          { schemaName: 'public', tableName: 'order_items', indexName: 'idx_order_items_composite', indexScans: 5670, tuplesRead: 5670, tuplesFetched: 5670, indexSize: '1536 kB', isUnused: false },
          { schemaName: 'public', tableName: 'products', indexName: 'idx_products_old_category', indexScans: 0, tuplesRead: 0, tuplesFetched: 0, indexSize: '512 kB', isUnused: true }
        ],
        tableHealth: [
          { tableName: 'products', rowCount: 1250, tableSize: '12 MB', indexSize: '8 MB', totalSize: '20 MB', lastVacuum: new Date('2024-12-01'), lastAnalyze: new Date('2024-12-01') },
          { tableName: 'orders', rowCount: 3450, tableSize: '18 MB', indexSize: '6 MB', totalSize: '24 MB', lastVacuum: new Date('2024-11-28'), lastAnalyze: new Date('2024-11-28') },
          { tableName: 'order_items', rowCount: 8920, tableSize: '22 MB', indexSize: '4 MB', totalSize: '26 MB', lastVacuum: new Date('2024-11-30'), lastAnalyze: new Date('2024-11-30') },
          { tableName: 'customers', rowCount: 890, tableSize: '4 MB', indexSize: '1 MB', totalSize: '5 MB', lastVacuum: new Date('2024-11-25'), lastAnalyze: new Date('2024-11-25') }
        ],
        recommendations: [
          'Consider adding index on products.current_stock for low stock queries - High sequential scan ratio (23.5%)',
          'Consider adding composite index on orders(customer_name, order_date) for customer history queries',
          'Found 1 unused indexes that could be dropped to improve write performance',
          'Table customers needs VACUUM maintenance for optimal performance'
        ],
        benchmarks: {
          productSkuLookup: 2.3,
          orderStatusFilter: 8.7,
          lowStockQuery: 45.2,
          customerHistory: 12.8
        },
        slowQueries: []
      };
      
      setTimeout(() => {
        setAnalysisResults(mockResults);
        setIsAnalyzing(false);
      }, 2000);
    } catch (error) {
      console.error('Database analysis failed:', error);
      setIsAnalyzing(false);
    }
  }, []);

  const applyIndexOptimizations = useCallback(async () => {
    alert('Database index optimization would apply the SQL migrations from migrations/0012_*.sql files. This requires database administrator privileges.');
  }, []);

  const getBenchmarkStatus = (value: number, threshold: number) => {
    if (value <= threshold) return { status: 'good', color: 'bg-green-500' };
    if (value <= threshold * 2) return { status: 'warning', color: 'bg-yellow-500' };
    return { status: 'critical', color: 'bg-red-500' };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Performance Analyzer</CardTitle>
          <CardDescription>
            Analyze PostgreSQL database performance, index usage, and query optimization opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={runDatabaseAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing Database...' : 'Run Database Analysis'}
            </Button>
            {analysisResults && (
              <Button onClick={applyIndexOptimizations} variant="outline">
                Apply Index Optimizations
              </Button>
            )}
          </div>

          {analysisResults && (
            <Alert>
              <AlertDescription>
                Analysis completed. Found {analysisResults.recommendations.length} optimization opportunities 
                across {analysisResults.indexHealth.length} indexes and {analysisResults.tableHealth.length} tables.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {analysisResults && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="indexes">Index Usage</TabsTrigger>
            <TabsTrigger value="tables">Table Statistics</TabsTrigger>
            <TabsTrigger value="benchmarks">Performance Benchmarks</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Indexes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysisResults.indexHealth.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {analysisResults.indexHealth.filter(i => i.isUnused).length} unused
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Database Tables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysisResults.tableHealth.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active schema tables
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Query Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(analysisResults.benchmarks.productSkuLookup || 0)}ms
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average critical query time
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Optimization Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {Math.max(0, 100 - analysisResults.recommendations.length * 15)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Performance rating
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Performance Health Check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Index Efficiency</h4>
                    <Progress 
                      value={Math.max(0, 100 - (analysisResults.indexHealth.filter(i => i.isUnused).length * 25))} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisResults.indexHealth.filter(i => !i.isUnused).length} of {analysisResults.indexHealth.length} indexes actively used
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Critical Query Performance</h4>
                    <Progress 
                      value={Math.max(0, 100 - (analysisResults.benchmarks.productSkuLookup || 0) * 2)} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on warehouse management query benchmarks
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indexes">
            <Card>
              <CardHeader>
                <CardTitle>Index Usage Statistics</CardTitle>
                <CardDescription>
                  Monitor which indexes are being used and identify optimization opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResults.indexHealth.map((index, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{index.indexName}</span>
                          {index.isUnused && (
                            <Badge variant="destructive">Unused</Badge>
                          )}
                          {index.indexScans > 10000 && (
                            <Badge variant="default">High Usage</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {index.tableName} • {index.indexSize}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{index.indexScans.toLocaleString()} scans</p>
                        <p className="text-xs text-muted-foreground">
                          {index.tuplesRead.toLocaleString()} tuples read
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tables">
            <Card>
              <CardHeader>
                <CardTitle>Table Statistics</CardTitle>
                <CardDescription>
                  Database table sizes, row counts, and maintenance information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResults.tableHealth.map((table, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <span className="font-medium">{table.tableName}</span>
                        <p className="text-sm text-muted-foreground">
                          {table.rowCount.toLocaleString()} rows • Total: {table.totalSize}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Table: {table.tableSize}</p>
                        <p className="text-sm">Indexes: {table.indexSize}</p>
                        {table.lastVacuum && (
                          <p className="text-xs text-muted-foreground">
                            Last vacuum: {new Date(table.lastVacuum).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="benchmarks">
            <Card>
              <CardHeader>
                <CardTitle>Performance Benchmarks</CardTitle>
                <CardDescription>
                  Key operation performance metrics for warehouse management queries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysisResults.benchmarks).map(([operation, time]) => {
                    const threshold = operation.includes('Lookup') ? 5 : operation.includes('Filter') ? 15 : 30;
                    const status = getBenchmarkStatus(time, threshold);
                    
                    return (
                      <div key={operation} className="p-4 border rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {operation.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                        </div>
                        <div className="text-2xl font-bold">{Math.round(time * 10) / 10}ms</div>
                        <div className="text-xs text-muted-foreground">
                          {status.status === 'good' && 'Optimal performance'}
                          {status.status === 'warning' && 'Consider optimization'}
                          {status.status === 'critical' && 'Needs immediate attention'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations">
            <div className="space-y-4">
              {analysisResults.recommendations.map((recommendation, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm">{recommendation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {analysisResults.recommendations.length === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-green-600 font-medium">Database is well optimized!</p>
                      <p className="text-sm text-muted-foreground">No immediate optimization recommendations found.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default DatabasePerformanceAnalyzer;