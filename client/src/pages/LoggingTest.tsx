import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, AlertTriangle, Info, Bug } from "lucide-react";

interface LogTestResult {
  success: boolean;
  message: string;
  requestId: string;
  timestamp: string;
  features_tested?: string[];
  details?: any;
}

export default function LoggingTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<LogTestResult[]>([]);
  const [scenario, setScenario] = useState<string>('default');
  const [delay, setDelay] = useState<string>('100');
  const [validationData, setValidationData] = useState<string>('');
  const { toast } = useToast();

  // Test comprehensive logging features
  const testComprehensiveLogging = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<LogTestResult>(`/api/test/logging?scenario=${scenario}`);
      setResults(prev => [response, ...prev]);
      
      toast({
        title: "Logging Test Completed",
        description: `Request ID: ${response.requestId}`,
      });
    } catch (error: any) {
      const errorResult: LogTestResult = {
        success: false,
        message: error.message || 'Test failed',
        requestId: error.requestId || 'unknown',
        timestamp: new Date().toISOString()
      };
      setResults(prev => [errorResult, ...prev]);
      
      toast({
        title: "Logging Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test request logging middleware
  const testRequestLogging = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<LogTestResult>(`/api/test/request-logging?delay=${delay}`);
      setResults(prev => [response, ...prev]);
      
      toast({
        title: "Request Logging Test Completed",
        description: `Delay: ${delay}ms`,
      });
    } catch (error: any) {
      toast({
        title: "Request Logging Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test validation error logging
  const testValidationLogging = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<LogTestResult>('/api/test/validation-logging', {
        method: 'POST',
        body: JSON.stringify({ testField: validationData }),
        headers: { 'Content-Type': 'application/json' }
      });
      setResults(prev => [response, ...prev]);
      
      toast({
        title: "Validation Test Completed",
        description: response.success ? "Validation passed" : "Validation failed (as expected)",
      });
    } catch (error: any) {
      const errorResult: LogTestResult = {
        success: false,
        message: error.message || 'Validation test failed',
        requestId: error.requestId || 'unknown',
        timestamp: new Date().toISOString(),
        details: error.details
      };
      setResults(prev => [errorResult, ...prev]);
      
      toast({
        title: "Validation Test Result",
        description: "Check console logs for validation error details",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    toast({
      title: "Results Cleared",
      description: "All test results have been cleared",
    });
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getScenarioDescription = (scenario: string) => {
    const descriptions = {
      default: "Standard logging flow with info, debug, and business events",
      error: "Intentional error to test error logging with stack traces",
      security: "Security event logging for suspicious activities",
      business: "Complex business event with structured metadata",
      performance: "Performance monitoring with timing measurements"
    };
    return descriptions[scenario as keyof typeof descriptions] || "Unknown scenario";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Winston Logging System Test</h1>
        <p className="text-muted-foreground">
          Test the comprehensive Winston logging system with structured JSON output, 
          request correlation IDs, and contextual information.
        </p>
      </div>

      <Tabs defaultValue="comprehensive" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comprehensive">Comprehensive Tests</TabsTrigger>
          <TabsTrigger value="request">Request Logging</TabsTrigger>
          <TabsTrigger value="validation">Validation Logging</TabsTrigger>
        </TabsList>

        <TabsContent value="comprehensive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Comprehensive Logging Features
              </CardTitle>
              <CardDescription>
                Test all logging features including structured JSON, error handling, 
                business events, security logging, and performance monitoring.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scenario">Test Scenario</Label>
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Flow</SelectItem>
                    <SelectItem value="error">Error Handling</SelectItem>
                    <SelectItem value="security">Security Events</SelectItem>
                    <SelectItem value="business">Business Events</SelectItem>
                    <SelectItem value="performance">Performance Monitoring</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {getScenarioDescription(scenario)}
                </p>
              </div>

              <Button 
                onClick={testComprehensiveLogging} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  'Run Comprehensive Test'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Request Logging Middleware
              </CardTitle>
              <CardDescription>
                Test automatic request/response logging with timing information 
                and correlation IDs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delay">Response Delay (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  placeholder="100"
                  min="0"
                  max="5000"
                />
                <p className="text-sm text-muted-foreground">
                  Simulate server processing time to test response timing logs
                </p>
              </div>

              <Button 
                onClick={testRequestLogging} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Request Logging'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Validation Error Logging
              </CardTitle>
              <CardDescription>
                Test validation error logging with structured error details 
                and field-level information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="validationData">Test Field (leave empty to trigger validation error)</Label>
                <Input
                  id="validationData"
                  value={validationData}
                  onChange={(e) => setValidationData(e.target.value)}
                  placeholder="Enter data or leave empty to test validation error"
                />
                <p className="text-sm text-muted-foreground">
                  Leave empty to test validation error logging, or enter data to test success logging
                </p>
              </div>

              <Button 
                onClick={testValidationLogging} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Validation Logging'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Recent logging test results with request correlation IDs
            </CardDescription>
          </div>
          <Button variant="outline" onClick={clearResults} disabled={results.length === 0}>
            Clear Results
          </Button>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No test results yet. Run a test to see structured logging output.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.success)}
                      <span className="font-medium">
                        {result.success ? 'Success' : 'Error'}
                      </span>
                      <Badge variant="outline">
                        {result.requestId}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(result.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm">{result.message}</p>

                  {result.features_tested && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Features Tested:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.features_tested.map((feature, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {feature.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.details && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Additional Details:</p>
                      <Textarea
                        value={JSON.stringify(result.details, null, 2)}
                        readOnly
                        className="font-mono text-xs"
                        rows={4}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logging Features Overview</CardTitle>
          <CardDescription>
            Current Winston logging system capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Core Features</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Structured JSON logging format</li>
                <li>• Request correlation IDs</li>
                <li>• Automatic request/response logging</li>
                <li>• Multiple log levels (error, warn, info, debug)</li>
                <li>• Contextual information (user, IP, timing)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Advanced Features</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Daily rotating log files</li>
                <li>• Error stack trace logging</li>
                <li>• Security event tracking</li>
                <li>• Business event logging</li>
                <li>• Performance monitoring</li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <h4 className="font-medium">Log File Locations</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><code>./logs/application-YYYY-MM-DD.log</code> - All application logs</p>
              <p><code>./logs/error-YYYY-MM-DD.log</code> - Error logs only</p>
              <p><code>./logs/exceptions-YYYY-MM-DD.log</code> - Uncaught exceptions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}