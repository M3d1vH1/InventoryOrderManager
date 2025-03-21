import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function ImageMigration() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    migrated: number;
    errors: number;
    results: any[];
  } | null>(null);

  const handleMigrateImages = async () => {
    try {
      setIsLoading(true);
      setResults(null);

      const response = await apiRequest<{
        success: boolean;
        migrated: number;
        errors: number;
        results: any[];
      }>('/api/migrate-images', {
        method: 'POST',
      });

      setResults(response);
      
      toast({
        title: 'Image Migration Complete',
        description: `Successfully migrated ${response.migrated} images. ${response.errors} errors encountered.`,
        variant: response.errors > 0 ? 'destructive' : 'default',
      });
    } catch (error) {
      console.error('Failed to migrate images:', error);
      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Product Image Migration</CardTitle>
        <CardDescription>
          Migrate product images to the centralized storage system for better persistence across deployments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>This utility will migrate all product images to a persistent storage location.</p>
            <p className="mt-2">
              Images will be stored in a standardized location that persists across deployments
              and can be configured using the STORAGE_PATH environment variable.
            </p>
          </div>

          {results && (
            <div className="mt-4 border rounded-md p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Migration Results</h3>
                {results.success ? (
                  <span className="text-green-500 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Success
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Failed
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Images Migrated:</span>
                  <span className="ml-2 font-medium">{results.migrated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="ml-2 font-medium">{results.errors}</span>
                </div>
              </div>
              
              {results.errors > 0 && (
                <div className="text-sm text-red-500">
                  Some images could not be migrated. Check the server logs for details.
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleMigrateImages} 
          disabled={isLoading}
          variant="default"
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Migrating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Migrate Images
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}