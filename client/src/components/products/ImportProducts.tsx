
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export const ImportProducts = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text
      });

      if (!response.ok) throw new Error('Import failed');
      
      const result = await response.json();
      toast({
        title: "Success",
        description: result.message,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
        id="product-import"
      />
      <label htmlFor="product-import">
        <Button disabled={isLoading} asChild>
          <span>Import Products (CSV)</span>
        </Button>
      </label>
    </div>
  );
};
