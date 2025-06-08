import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import BarcodeGenerator from '@/components/barcode/BarcodeGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
}

const ProductBarcode = () => {
  // Use the route to get the product ID
  const [, params] = useRoute<{ id: string }>('/product-barcode/:id');
  const productId = params?.id ? parseInt(params.id, 10) : 0;

  // Fetch the product data
  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['/api/products', productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      return response.json();
    },
    enabled: !!productId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="h-12 w-12 border-4 border-t-primary border-slate-200 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading product information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="bg-red-100 text-red-600 p-4 rounded-md mb-4">
              <p>Error loading product information. The product may not exist.</p>
            </div>
            <Link href="/products">
              <Button variant="outline">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/products">
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
        <h1 className="text-2xl font-bold ml-4">Product Barcode</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Product Name</p>
                <p className="font-medium">{product.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">SKU</p>
                <p className="font-medium">{product.sku}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Category</p>
                <p className="font-medium capitalize">{product.category}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Current Stock</p>
                <p className="font-medium">{product.currentStock}</p>
              </div>
              {product.description && (
                <div>
                  <p className="text-sm text-slate-500">Description</p>
                  <p>{product.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Barcode</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <BarcodeGenerator 
              value={product.sku} 
              format="CODE128"
              height={100}
              displayValue={true}
              showDownloadButton={true}
              showPrintButton={true}
              className="w-full"
            />
            <p className="text-sm text-slate-500 mt-4">
              Scan this barcode using your warehouse scanner to quickly find or update this product.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductBarcode;