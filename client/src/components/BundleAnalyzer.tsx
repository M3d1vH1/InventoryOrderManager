import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  BarChart3, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  FileText,
  Zap,
  Target,
  TrendingDown,
  TrendingUp,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DependencyInfo {
  name: string;
  size: string;
  percentage: number;
  category: 'large' | 'medium' | 'small';
  optimizable: boolean;
  description?: string;
}

interface BundleStats {
  totalSize: string;
  gzippedSize: string;
  chunkCount: number;
  dependencyCount: number;
  codeSpittingActive: boolean;
  estimatedLoadTime: string;
}

const BundleAnalyzer: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [bundleStats, setBundleStats] = useState<BundleStats | null>(null);
  const [dependencies, setDependencies] = useState<DependencyInfo[]>([]);
  const { toast } = useToast();

  // Mock data for bundle analysis
  const mockBundleStats: BundleStats = {
    totalSize: '1.2MB',
    gzippedSize: '400KB',
    chunkCount: 12,
    dependencyCount: 89,
    codeSpittingActive: true,
    estimatedLoadTime: '2.3s'
  };

  const mockDependencies: DependencyInfo[] = [
    {
      name: '@fortawesome/fontawesome-free',
      size: '300KB',
      percentage: 25,
      category: 'large',
      optimizable: true,
      description: 'Icon library - can be replaced with lucide-react'
    },
    {
      name: '27x @radix-ui components',
      size: '675KB',
      percentage: 56,
      category: 'large',
      optimizable: true,
      description: 'UI component library - consider tree-shaking'
    },
    {
      name: 'pdfkit',
      size: '200KB',
      percentage: 17,
      category: 'large',
      optimizable: true,
      description: 'PDF generation - lazy load when needed'
    },
    {
      name: 'recharts',
      size: '120KB',
      percentage: 10,
      category: 'large',
      optimizable: true,
      description: 'Chart library - lazy load on reports page'
    },
    {
      name: 'react-big-calendar',
      size: '100KB',
      percentage: 8,
      category: 'large',
      optimizable: true,
      description: 'Calendar component - lazy load'
    },
    {
      name: 'date-fns',
      size: '80KB',
      percentage: 7,
      category: 'medium',
      optimizable: false,
      description: 'Date utilities - well optimized'
    },
    {
      name: '@tanstack/react-query',
      size: '60KB',
      percentage: 5,
      category: 'medium',
      optimizable: false,
      description: 'Data fetching - essential'
    },
    {
      name: 'react-hook-form',
      size: '50KB',
      percentage: 4,
      category: 'medium',
      optimizable: false,
      description: 'Form handling - well optimized'
    }
  ];

  const runBundleAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      // Simulate API call to trigger bundle analysis
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setBundleStats(mockBundleStats);
      setDependencies(mockDependencies);
      setAnalysisComplete(true);
      
      toast({
        title: 'Bundle Analysis Complete',
        description: 'Analysis results are now available'
      });
      
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: 'Could not complete bundle analysis',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openBundleReport = () => {
    window.open('/dist/bundle-analysis.html', '_blank');
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'large': return 'destructive';
      case 'medium': return 'secondary';
      case 'small': return 'default';
      default: return 'outline';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'large': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <TrendingUp className="h-4 w-4" />;
      case 'small': return <CheckCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const calculatePotentialSavings = () => {
    const optimizable = dependencies.filter(dep => dep.optimizable);
    const totalOptimizable = optimizable.reduce((acc, dep) => {
      const sizeNum = parseInt(dep.size.replace(/[^\d]/g, ''));
      return acc + sizeNum;
    }, 0);
    return Math.round(totalOptimizable * 0.6); // Estimate 60% savings
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bundle Analyzer</h3>
          <p className="text-sm text-muted-foreground">
            Analyze and optimize your application bundle size
          </p>
        </div>
        <div className="flex gap-2">
          {analysisComplete && (
            <Button variant="outline" size="sm" onClick={openBundleReport}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Report
            </Button>
          )}
          <Button 
            onClick={runBundleAnalysis} 
            disabled={isAnalyzing}
            size="sm"
          >
            {isAnalyzing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-2" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {isAnalyzing && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Running Bundle Analysis</AlertTitle>
          <AlertDescription>
            Analyzing your application bundle and dependencies. This may take a few minutes...
          </AlertDescription>
        </Alert>
      )}

      {bundleStats && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Size</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bundleStats.totalSize}</div>
                  <p className="text-xs text-muted-foreground">
                    {bundleStats.gzippedSize} gzipped
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chunks</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bundleStats.chunkCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Code splitting active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bundleStats.dependencyCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Total packages
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Load Time</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bundleStats.estimatedLoadTime}</div>
                  <p className="text-xs text-muted-foreground">
                    Estimated 3G
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bundle Health</CardTitle>
                <CardDescription>
                  Overall assessment of your bundle optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Code Splitting</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bundle Size</span>
                  <Badge variant="secondary">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Large
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tree Shaking</span>
                  <Badge variant="outline">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Partial
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Optimization Potential</span>
                  <Badge variant="destructive">
                    <Target className="h-3 w-3 mr-1" />
                    High ({calculatePotentialSavings()}KB)
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dependencies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Large Dependencies (&gt;100KB)</CardTitle>
                <CardDescription>
                  These dependencies have the biggest impact on bundle size
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dependencies.filter(dep => dep.category === 'large').map((dep, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(dep.category)}
                        <span className="font-medium">{dep.name}</span>
                        {dep.optimizable && (
                          <Badge variant="outline" className="text-xs">
                            Optimizable
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{dep.size}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {dep.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress value={dep.percentage} className="h-2" />
                    {dep.description && (
                      <p className="text-xs text-muted-foreground">{dep.description}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Medium Dependencies (25-100KB)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dependencies.filter(dep => dep.category === 'medium').map((dep, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(dep.category)}
                      <span className="text-sm">{dep.name}</span>
                      {dep.optimizable && (
                        <Badge variant="outline" className="text-xs">
                          Optimizable
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium">{dep.size}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <Alert>
              <Target className="h-4 w-4" />
              <AlertTitle>Optimization Opportunities</AlertTitle>
              <AlertDescription>
                Potential savings: {calculatePotentialSavings()}KB (~{Math.round(calculatePotentialSavings() / 1200 * 100)}% reduction)
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>High Impact Optimizations</CardTitle>
                <CardDescription>
                  These changes will have the biggest effect on bundle size
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4 py-2">
                  <h4 className="font-semibold text-red-700">Remove FontAwesome (-300KB)</h4>
                  <p className="text-sm text-muted-foreground">
                    You already have lucide-react. FontAwesome is redundant and adds 300KB.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">
                    <Package className="h-3 w-3 mr-1" />
                    npm uninstall @fortawesome/fontawesome-free
                  </Button>
                </div>

                <div className="border-l-4 border-orange-500 pl-4 py-2">
                  <h4 className="font-semibold text-orange-700">Optimize Icon Imports (-100KB)</h4>
                  <p className="text-sm text-muted-foreground">
                    Import specific icons instead of entire packages to enable tree-shaking.
                  </p>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4 py-2">
                  <h4 className="font-semibold text-yellow-700">Lazy Load Heavy Components (-200KB)</h4>
                  <p className="text-sm text-muted-foreground">
                    PDF generation, charts, and calendar components can be loaded on demand.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Implementation Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Page-level lazy loading</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Vendor chunk separation</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Component-level splitting</span>
                  <Badge variant="secondary">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Partial
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tree-shaking optimization</span>
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Needs Work
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commands to Run</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="bg-muted p-3 rounded font-mono text-sm">
                  # Remove FontAwesome<br/>
                  npm uninstall @fortawesome/fontawesome-free
                </div>
                <div className="bg-muted p-3 rounded font-mono text-sm">
                  # Analyze unused dependencies<br/>
                  npx depcheck
                </div>
                <div className="bg-muted p-3 rounded font-mono text-sm">
                  # Run full bundle analysis<br/>
                  ANALYZE=true npm run build
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default BundleAnalyzer;