import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, SortAsc, SortDesc, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportData } from '@/lib/utils';

interface SlowMovingProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  lastStockUpdate: string | null;
  daysWithoutMovement: number;
}

export default function SlowMovingItems() {
  const { t } = useTranslation();
  const [daysThreshold, setDaysThreshold] = useState<number>(60);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof SlowMovingProduct>('daysWithoutMovement');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch slow-moving products
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/inventory/slow-moving', daysThreshold],
    queryFn: async () => {
      return apiRequest(`/api/inventory/slow-moving?days=${daysThreshold}`);
    },
    select: (data: any) => {
      // Handle API response structure: { success: true, data: [...] } or { products: [...] }
      if (data && typeof data === 'object') {
        if ('data' in data && Array.isArray(data.data)) {
          return { products: data.data };
        }
        if ('products' in data && Array.isArray(data.products)) {
          return data;
        }
      }
      return { products: [] };
    }
  });

  const products = data?.products || [];

  // Filter products based on search term
  const filteredProducts = products.filter((product: SlowMovingProduct) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.sku.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower)
    );
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a: SlowMovingProduct, b: SlowMovingProduct) => {
    // Handle special case for daysWithoutMovement
    if (sortField === 'daysWithoutMovement') {
      return sortDirection === 'asc'
        ? a.daysWithoutMovement - b.daysWithoutMovement
        : b.daysWithoutMovement - a.daysWithoutMovement;
    }

    // Handle standard string fields
    if (typeof a[sortField] === 'string' && typeof b[sortField] === 'string') {
      const valA = a[sortField] as string;
      const valB = b[sortField] as string;
      return sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    // Handle numeric fields
    if (typeof a[sortField] === 'number' && typeof b[sortField] === 'number') {
      const valA = a[sortField] as number;
      const valB = b[sortField] as number;
      return sortDirection === 'asc'
        ? valA - valB
        : valB - valA;
    }

    return 0;
  });

  // Handler for toggling sort direction or changing sort field
  const handleSort = (field: keyof SlowMovingProduct) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending when changing fields
    }
  };

  // Export data function
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const exportData = sortedProducts.map((product: SlowMovingProduct) => ({
      [t('product.name')]: product.name,
      [t('product.sku')]: product.sku,
      [t('product.category')]: product.category,
      [t('product.currentStock')]: product.currentStock,
      [t('product.daysWithoutMovement')]: product.daysWithoutMovement,
      [t('product.lastUpdated')]: product.lastStockUpdate ? new Date(product.lastStockUpdate).toLocaleDateString() : t('common.never'),
    }));

    exportData(exportData, format, t('dashboard.slowMovingInventory'));
  };

  // Render badge for products based on days without movement
  const renderAgeBadge = (days: number) => {
    if (days > 120) {
      return <Badge variant="destructive">{days} {t('common.days')}</Badge>;
    } else if (days > 90) {
      return <Badge variant="warning">{days} {t('common.days')}</Badge>;
    } else {
      return <Badge variant="outline">{days} {t('common.days')}</Badge>;
    }
  };

  if (error) return <div className="text-red-500">{t('common.error')}: {String(error)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold">{t('dashboard.slowMovingInventory')}</h3>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select
            value={daysThreshold.toString()}
            onValueChange={(value) => setDaysThreshold(parseInt(value))}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('dashboard.selectDays')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 {t('common.days')}</SelectItem>
              <SelectItem value="60">60 {t('common.days')}</SelectItem>
              <SelectItem value="90">90 {t('common.days')}</SelectItem>
              <SelectItem value="120">120 {t('common.days')}</SelectItem>
            </SelectContent>
          </Select>
          
          <Input
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-auto"
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('common.export')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4">{t('common.loading')}...</div>
      ) : sortedProducts.length === 0 ? (
        <div className="text-center py-4">{t('common.noData')}</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  {t('product.name')} 
                  {sortField === 'name' && (
                    sortDirection === 'asc' ? <SortAsc className="inline ml-1 h-4 w-4" /> : <SortDesc className="inline ml-1 h-4 w-4" />
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('sku')}
                >
                  {t('product.sku')}
                  {sortField === 'sku' && (
                    sortDirection === 'asc' ? <SortAsc className="inline ml-1 h-4 w-4" /> : <SortDesc className="inline ml-1 h-4 w-4" />
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('category')}
                >
                  {t('product.category')}
                  {sortField === 'category' && (
                    sortDirection === 'asc' ? <SortAsc className="inline ml-1 h-4 w-4" /> : <SortDesc className="inline ml-1 h-4 w-4" />
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-right"
                  onClick={() => handleSort('currentStock')}
                >
                  {t('product.currentStock')}
                  {sortField === 'currentStock' && (
                    sortDirection === 'asc' ? <SortAsc className="inline ml-1 h-4 w-4" /> : <SortDesc className="inline ml-1 h-4 w-4" />
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-right"
                  onClick={() => handleSort('daysWithoutMovement')}
                >
                  {t('product.daysWithoutMovement')}
                  {sortField === 'daysWithoutMovement' && (
                    sortDirection === 'asc' ? <SortAsc className="inline ml-1 h-4 w-4" /> : <SortDesc className="inline ml-1 h-4 w-4" />
                  )}
                </TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.map((product: SlowMovingProduct) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell className="text-right">{product.currentStock}</TableCell>
                  <TableCell className="text-right">
                    {renderAgeBadge(product.daysWithoutMovement)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t('common.open')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          {t('product.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          {t('product.update')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}