import React, { memo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";

interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
  location?: string;
  tags?: string[];
}

interface OptimizedProductRowProps {
  product: Product;
  isHighlighted: boolean;
  highlightedRowRef?: React.RefObject<HTMLTableRowElement>;
  onStockChange: (id: number, stock: number) => void;
  onTagClick: (tag: string) => void;
  isPending: boolean;
}

const getStockStatusClass = (currentStock: number, minStockLevel: number): string => {
  if (currentStock === 0) return "text-red-600";
  if (currentStock <= minStockLevel) return "text-amber-600";
  return "text-green-600";
};

const getStockStatus = (currentStock: number, minStockLevel: number): string => {
  if (currentStock === 0) return "Out of Stock";
  if (currentStock <= minStockLevel) return "Low Stock";
  return "In Stock";
};

const getStatusBadgeClass = (currentStock: number, minStockLevel: number): string => {
  if (currentStock === 0) return 'bg-red-100 text-red-800';
  if (currentStock <= minStockLevel) return 'bg-amber-100 text-amber-800';
  return 'bg-green-100 text-green-800';
};

// Memoized tag component to prevent unnecessary re-renders
const ProductTag = memo<{ tag: string; onClick: (tag: string) => void }>(({ tag, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(tag);
  }, [tag, onClick]);

  return (
    <Badge 
      variant="outline" 
      className="cursor-pointer"
      onClick={handleClick}
    >
      {tag}
    </Badge>
  );
});

ProductTag.displayName = "ProductTag";

// Memoized stock input component
const StockInput = memo<{ 
  productId: number; 
  currentStock: number; 
  onStockChange: (id: number, stock: number) => void;
}>(({ productId, currentStock, onStockChange }) => {
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    if (!isNaN(newValue) && newValue !== currentStock) {
      onStockChange(productId, newValue);
    }
  }, [productId, currentStock, onStockChange]);

  return (
    <Input 
      type="number" 
      min="0" 
      className="w-20" 
      defaultValue={currentStock}
      onBlur={handleBlur}
    />
  );
});

StockInput.displayName = "StockInput";

// Memoized action buttons component
const ProductActions = memo<{
  productId: number;
  currentStock: number;
  onStockChange: (id: number, stock: number) => void;
  isPending: boolean;
}>(({ productId, currentStock, onStockChange, isPending }) => {
  const handleIncrement = useCallback(() => {
    onStockChange(productId, currentStock + 10);
  }, [productId, currentStock, onStockChange]);

  return (
    <div className="flex items-center gap-2">
      <StockInput 
        productId={productId}
        currentStock={currentStock}
        onStockChange={onStockChange}
      />
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleIncrement}
        disabled={isPending}
      >
        +10
      </Button>
    </div>
  );
});

ProductActions.displayName = "ProductActions";

// Main optimized product row component
const OptimizedProductRow = memo<OptimizedProductRowProps>(({
  product,
  isHighlighted,
  highlightedRowRef,
  onStockChange,
  onTagClick,
  isPending
}) => {
  const stockStatusClass = React.useMemo(() => 
    getStockStatusClass(product.currentStock, product.minStockLevel), 
    [product.currentStock, product.minStockLevel]
  );

  const stockStatus = React.useMemo(() => 
    getStockStatus(product.currentStock, product.minStockLevel), 
    [product.currentStock, product.minStockLevel]
  );

  const statusBadgeClass = React.useMemo(() => 
    getStatusBadgeClass(product.currentStock, product.minStockLevel), 
    [product.currentStock, product.minStockLevel]
  );

  const memoizedTags = React.useMemo(() => {
    if (!product.tags || product.tags.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {product.tags.map(tag => (
          <ProductTag 
            key={tag} 
            tag={tag}
            onClick={onTagClick}
          />
        ))}
      </div>
    );
  }, [product.tags, onTagClick]);

  return (
    <TableRow 
      key={product.id} 
      ref={isHighlighted ? highlightedRowRef : undefined}
      className={isHighlighted ? 'bg-blue-50 animate-pulse' : ''}
    >
      <TableCell>
        <div>
          <div>{product.name}</div>
          {memoizedTags}
        </div>
      </TableCell>
      <TableCell>{product.sku}</TableCell>
      <TableCell>{product.location || "-"}</TableCell>
      <TableCell>{product.minStockLevel}</TableCell>
      <TableCell>
        <span className={`font-medium ${stockStatusClass}`}>
          {product.currentStock}
        </span>
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}>
          {stockStatus}
        </span>
      </TableCell>
      <TableCell>
        <ProductActions
          productId={product.id}
          currentStock={product.currentStock}
          onStockChange={onStockChange}
          isPending={isPending}
        />
      </TableCell>
    </TableRow>
  );
});

OptimizedProductRow.displayName = "OptimizedProductRow";

export default OptimizedProductRow;