import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Printer, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

const PrinterTestPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const runPrinterTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await apiRequest({
        url: "/api/test-printer",
        method: "GET",
      });
      
      setTestResult(response);
      
      toast({
        title: response.success
          ? "Printer test successful!"
          : "Printer test failed",
        description: response.message,
        variant: response.success ? "default" : "destructive",
      });
    } catch (error: any) {
      const errorMessage = error.message || "An unknown error occurred";
      setTestResult({
        success: false,
        message: errorMessage,
      });
      
      toast({
        title: "Printer test failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">CAB EOS 1 Printer Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Printer className="mr-2 h-5 w-5" />
            Printer Test
          </CardTitle>
          <CardDescription>
            Test your CAB EOS 1 printer to ensure it's properly connected and working
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <p>
              This page will help you verify that your CAB EOS 1 printer is properly connected to the system.
              When you click the test button below, a test label will be sent directly to your printer.
            </p>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={runPrinterTest}
                disabled={testing}
                className="w-40"
                variant="default"
              >
                {testing ? "Testing..." : "Run Printer Test"}
              </Button>
              
              {testResult && (
                <div className="flex items-center">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
            
            {!testResult && (
              <p className="text-sm text-gray-500">
                Click the button to send a test label to your CAB EOS 1 printer.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">If the printer doesn't respond:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Check that the printer is powered on and connected to your computer</li>
                <li>Verify that the printer driver is installed correctly</li>
                <li>For Windows: Check if the printer is connected to the correct COM port (usually COM1 or COM3)</li>
                <li>For Linux/Mac: Verify the printer is set up in CUPS with the name "CABEOS1"</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">If you're getting errors:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Check the server logs for detailed error messages</li>
                <li>Make sure the printer is not in an error state (paper jam, out of labels, etc.)</li>
                <li>Try restarting both the printer and the application</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrinterTestPage;