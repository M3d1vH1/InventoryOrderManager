import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportData } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CalendarIcon, ArrowUpDown, Download } from "lucide-react";

// For managing the sorting state
type SortDirection = "asc" | "desc";
type SortColumn = "name" | "days" | "stock";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

// Types for SlowMovingProduct from API response
interface SlowMovingProduct {
  id: number;
  name: string;
  sku: string;
  category?: string;
  currentStock: number;
  lastStockUpdate: string | null;
  daysWithoutMovement: number;
}

const SlowMovingItems = () => {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [sortState, setSortState] = useState<SortState>({
    column: "days",
    direction: "desc"
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/inventory/slow-moving"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleSort = (column: SortColumn) => {
    setSortState((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedData = () => {
    if (!data?.products) return [];
    
    return [...data.products].sort((a: SlowMovingProduct, b: SlowMovingProduct) => {
      const { column, direction } = sortState;
      const factor = direction === "asc" ? 1 : -1;
      
      if (column === "name") {
        return a.name.localeCompare(b.name) * factor;
      } else if (column === "days") {
        return (a.daysWithoutMovement - b.daysWithoutMovement) * factor;
      } else if (column === "stock") {
        return (a.currentStock - b.currentStock) * factor;
      }
      return 0;
    });
  };

  // Format the date or return 'Unknown'
  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("inventory.unknown");
    return format(new Date(dateString), "dd MMM yyyy");
  };

  // Handle exporting the data
  const handleExport = (format: string) => {
    if (!data?.products || data.products.length === 0) return;
    
    const exportProducts = data.products.map((product: SlowMovingProduct) => ({
      [t("products.productName")]: product.name,
      [t("products.sku")]: product.sku,
      [t("products.category")]: product.category || "",
      [t("inventory.stockLevel")]: product.currentStock,
      [t("inventory.notMovedInDays")]: product.daysWithoutMovement,
      [t("inventory.lastUpdate")]: formatDate(product.lastStockUpdate)
    }));
    
    exportData(exportProducts, format, t("inventory.slowMovingItems"));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{t("inventory.slowMovingItems")}</CardTitle>
          <CardDescription>
            {t("inventory.slowMovingItems")}
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport("csv")}
            disabled={isLoading || !data?.products || data.products.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("inventory.export")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">
            {t("app.error")}
          </div>
        ) : data?.products && data.products.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      {t("products.productName")}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>
                    {t("products.sku")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer text-right"
                    onClick={() => handleSort("days")}
                  >
                    <div className="flex items-center justify-end">
                      {t("inventory.notMovedInDays")}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  {!isMobile && (
                    <TableHead>
                      <div className="flex items-center">
                        {t("inventory.lastUpdate")}
                      </div>
                    </TableHead>
                  )}
                  <TableHead 
                    className="cursor-pointer text-right"
                    onClick={() => handleSort("stock")}
                  >
                    <div className="flex items-center justify-end">
                      {t("inventory.stock")}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData().map((product: SlowMovingProduct) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={product.daysWithoutMovement > 90 ? "destructive" : "secondary"}>
                        {product.daysWithoutMovement} {t("app.days")}
                      </Badge>
                    </TableCell>
                    {!isMobile && (
                      <TableCell>
                        <div className="flex items-center">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          {formatDate(product.lastStockUpdate)}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {product.currentStock}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t("inventory.noSlowMovingItems")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlowMovingItems;