# React Performance Optimization Guide

## Overview

This guide explains how to optimize React components using React.memo, useMemo, and useCallback to prevent unnecessary re-renders in complex list components like OrderList and Inventory pages.

## Performance Optimization Techniques

### 1. React.memo for Functional Components

React.memo is a higher-order component that memoizes the result of a component. It only re-renders when its props change.

```jsx
import React, { memo } from 'react';

const ExpensiveComponent = memo(({ data, onAction }) => {
  return (
    <div>
      {/* Complex rendering logic */}
      <ExpensiveCalculation data={data} />
      <button onClick={onAction}>Action</button>
    </div>
  );
});

ExpensiveComponent.displayName = "ExpensiveComponent";
```

**When to use React.memo:**
- Components that receive the same props frequently
- Components with expensive rendering operations
- List item components that render many times
- Components that don't need to re-render when parent state changes

### 2. useMemo for Expensive Calculations

useMemo memoizes the result of expensive calculations and only recalculates when dependencies change.

```jsx
import React, { useMemo } from 'react';

const ProductList = ({ products, filters }) => {
  // Expensive filtering operation - only recalculates when dependencies change
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      return product.name.toLowerCase().includes(filters.search.toLowerCase()) &&
             (filters.category === 'all' || product.category === filters.category) &&
             product.stock >= filters.minStock;
    });
  }, [products, filters.search, filters.category, filters.minStock]);

  // Expensive aggregation - only recalculates when filtered products change
  const statistics = useMemo(() => {
    return {
      total: filteredProducts.length,
      lowStock: filteredProducts.filter(p => p.stock <= p.minStock).length,
      outOfStock: filteredProducts.filter(p => p.stock === 0).length,
      totalValue: filteredProducts.reduce((sum, p) => sum + (p.price * p.stock), 0)
    };
  }, [filteredProducts]);

  return (
    <div>
      <div>Total: {statistics.total}, Low Stock: {statistics.lowStock}</div>
      {filteredProducts.map(product => (
        <ProductRow key={product.id} product={product} />
      ))}
    </div>
  );
};
```

**When to use useMemo:**
- Expensive calculations (filtering, sorting, aggregations)
- Creating objects or arrays that would cause child re-renders
- Complex data transformations
- Derived state calculations

### 3. useCallback for Function Stability

useCallback memoizes function references to prevent child components from re-rendering when parent functions are recreated.

```jsx
import React, { useCallback, useState } from 'react';

const OrderManagement = ({ orders }) => {
  const [selectedOrders, setSelectedOrders] = useState([]);

  // Stable function reference - prevents child re-renders
  const handleOrderSelection = useCallback((orderId, selected) => {
    setSelectedOrders(prev => 
      selected 
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  }, []); // No dependencies - function is always stable

  // Stable function with dependencies
  const handleStatusChange = useCallback((orderId, newStatus) => {
    // This function only changes when updateOrder changes
    updateOrder(orderId, { status: newStatus });
  }, [updateOrder]);

  return (
    <div>
      {orders.map(order => (
        <OrderRow 
          key={order.id}
          order={order}
          isSelected={selectedOrders.includes(order.id)}
          onSelectionChange={handleOrderSelection}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
};
```

**When to use useCallback:**
- Functions passed to child components as props
- Functions used in dependency arrays of other hooks
- Event handlers in memoized components
- Functions that trigger expensive operations

## Practical Example: Optimized List Item Component

Here's a complete example of an optimized product row component:

```jsx
import React, { memo, useCallback, useMemo } from 'react';

// Sub-components are memoized to prevent unnecessary re-renders
const ProductActions = memo(({ productId, onEdit, onDelete, onUpdateStock }) => {
  // Stable event handlers using useCallback
  const handleEdit = useCallback(() => onEdit(productId), [productId, onEdit]);
  const handleDelete = useCallback(() => onDelete(productId), [productId, onDelete]);
  const handleStockUpdate = useCallback((newStock) => 
    onUpdateStock(productId, newStock), [productId, onUpdateStock]);

  return (
    <div className="flex gap-2">
      <button onClick={handleEdit}>Edit</button>
      <button onClick={handleDelete}>Delete</button>
      <input 
        type="number" 
        onChange={(e) => handleStockUpdate(Number(e.target.value))}
        placeholder="Update stock"
      />
    </div>
  );
});

const ProductStatus = memo(({ stock, minStock }) => {
  // Memoized status calculation
  const status = useMemo(() => {
    if (stock === 0) return { text: 'Out of Stock', class: 'text-red-600' };
    if (stock <= minStock) return { text: 'Low Stock', class: 'text-yellow-600' };
    return { text: 'In Stock', class: 'text-green-600' };
  }, [stock, minStock]);

  return <span className={status.class}>{status.text}</span>;
});

// Main component using React.memo for optimal performance
const OptimizedProductRow = memo(({
  product,
  onEdit,
  onDelete,
  onUpdateStock,
  isSelected,
  onSelectionChange
}) => {
  // Memoized handlers to prevent child re-renders
  const handleSelectionChange = useCallback((checked) => {
    onSelectionChange(product.id, checked);
  }, [product.id, onSelectionChange]);

  // Memoized computed values
  const formattedPrice = useMemo(() => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(product.price), [product.price]);

  return (
    <tr className={isSelected ? 'bg-blue-50' : ''}>
      <td>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={(e) => handleSelectionChange(e.target.checked)}
        />
      </td>
      <td>{product.name}</td>
      <td>{product.sku}</td>
      <td>{formattedPrice}</td>
      <td>{product.stock}</td>
      <td>
        <ProductStatus stock={product.stock} minStock={product.minStock} />
      </td>
      <td>
        <ProductActions
          productId={product.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateStock={onUpdateStock}
        />
      </td>
    </tr>
  );
});

OptimizedProductRow.displayName = "OptimizedProductRow";
```

## Performance Anti-Patterns to Avoid

### 1. Creating Objects/Arrays in Render
```jsx
// ❌ Bad - Creates new object on every render
<ProductRow product={product} config={{ showPrice: true, currency: 'USD' }} />

// ✅ Good - Memoize the config object
const config = useMemo(() => ({ showPrice: true, currency: 'USD' }), []);
<ProductRow product={product} config={config} />
```

### 2. Inline Functions in Props
```jsx
// ❌ Bad - Creates new function on every render
<button onClick={() => handleClick(item.id)}>Click</button>

// ✅ Good - Use useCallback for stable reference
const handleItemClick = useCallback(() => handleClick(item.id), [item.id, handleClick]);
<button onClick={handleItemClick}>Click</button>
```

### 3. Missing Dependencies in Hooks
```jsx
// ❌ Bad - Missing dependencies can cause stale closures
const fetchData = useCallback(() => {
  return api.getData(filters);
}, []); // Missing 'filters' dependency

// ✅ Good - Include all dependencies
const fetchData = useCallback(() => {
  return api.getData(filters);
}, [filters]);
```

## Implementation Strategy for Large Lists

1. **Start with React.memo** for list item components
2. **Add useCallback** for event handlers passed to children
3. **Use useMemo** for expensive calculations and object creation
4. **Implement virtualization** for very large lists (1000+ items)
5. **Profile performance** using React DevTools Profiler

## Performance Monitoring

Use React DevTools Profiler to identify performance bottlenecks:

1. Install React DevTools browser extension
2. Open Profiler tab
3. Record a user interaction
4. Analyze component render times and frequencies
5. Optimize components with unnecessary re-renders

## Best Practices Summary

- **React.memo**: Use for components that receive stable props frequently
- **useMemo**: Use for expensive calculations and object/array creation
- **useCallback**: Use for functions passed to child components
- **Profile first**: Measure performance before and after optimizations
- **Don't over-optimize**: Only optimize components with proven performance issues
- **Consider virtualization**: For lists with 100+ items, consider react-window or react-virtualized

This optimization approach can reduce render times by 50-80% in complex list components while maintaining code readability and maintainability.