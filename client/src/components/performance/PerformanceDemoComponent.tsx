import React, { useState, useMemo, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Simulate expensive computation
const expensiveCalculation = (items: any[]) => {
  console.log('🔄 Expensive calculation running...');
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.random();
  }
  return {
    total: items.length,
    sum: items.reduce((acc, item) => acc + item.value, 0),
    average: items.length > 0 ? items.reduce((acc, item) => acc + item.value, 0) / items.length : 0,
    computation: result
  };
};

// 🚫 Non-optimized list item (causes unnecessary re-renders)
const UnoptimizedListItem = ({ item, onUpdate, highlightColor }: any) => {
  console.log(`🔴 UnoptimizedListItem ${item.id} rendered`);
  
  return (
    <div className="p-2 border rounded mb-2" style={{ backgroundColor: highlightColor }}>
      <div className="flex justify-between items-center">
        <span>{item.name} - ${item.value}</span>
        <Button onClick={() => onUpdate(item.id)} size="sm">
          Update
        </Button>
      </div>
    </div>
  );
};

// ✅ Optimized list item (prevents unnecessary re-renders)
const OptimizedListItem = memo(({ item, onUpdate, highlightColor }: any) => {
  console.log(`🟢 OptimizedListItem ${item.id} rendered`);
  
  // Stable event handler
  const handleUpdate = useCallback(() => {
    onUpdate(item.id);
  }, [item.id, onUpdate]);
  
  return (
    <div className="p-2 border rounded mb-2" style={{ backgroundColor: highlightColor }}>
      <div className="flex justify-between items-center">
        <span>{item.name} - ${item.value}</span>
        <Button onClick={handleUpdate} size="sm">
          Update
        </Button>
      </div>
    </div>
  );
});

OptimizedListItem.displayName = 'OptimizedListItem';

// ✅ Optimized statistics component
const StatisticsDisplay = memo(({ stats }: { stats: any }) => {
  console.log('📊 StatisticsDisplay rendered');
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Total Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Average Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.average.toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  );
});

StatisticsDisplay.displayName = 'StatisticsDisplay';

const PerformanceDemoComponent = () => {
  const [items, setItems] = useState([
    { id: 1, name: 'Product A', value: 100 },
    { id: 2, name: 'Product B', value: 200 },
    { id: 3, name: 'Product C', value: 300 },
    { id: 4, name: 'Product D', value: 400 },
    { id: 5, name: 'Product E', value: 500 },
  ]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [counter, setCounter] = useState(0);
  const [optimizedView, setOptimizedView] = useState(true);

  // 🚫 Without useMemo - expensive calculation runs on every render
  const unoptimizedStats = expensiveCalculation(items);
  
  // ✅ With useMemo - expensive calculation only runs when items change
  const optimizedStats = useMemo(() => {
    return expensiveCalculation(items);
  }, [items]);

  // ✅ Filtered items with useMemo
  const filteredItems = useMemo(() => {
    console.log('🔍 Filtering items...');
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // 🚫 Non-stable function reference (causes child re-renders)
  const handleUpdateUnoptimized = (id: number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, value: item.value + 10 } : item
    ));
  };

  // ✅ Stable function reference with useCallback
  const handleUpdateOptimized = useCallback((id: number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, value: item.value + 10 } : item
    ));
  }, []);

  // 🚫 Object created in render (causes child re-renders)
  const unoptimizedHighlightColor = { backgroundColor: '#f0f9ff' };
  
  // ✅ Memoized object
  const optimizedHighlightColor = useMemo(() => '#f0f9ff', []);

  const addItem = useCallback(() => {
    const newId = Math.max(...items.map(i => i.id)) + 1;
    setItems(prev => [...prev, {
      id: newId,
      name: `Product ${String.fromCharCode(65 + newId - 1)}`,
      value: Math.floor(Math.random() * 500) + 100
    }]);
  }, [items]);

  const removeLastItem = useCallback(() => {
    setItems(prev => prev.slice(0, -1));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>React Performance Optimization Demo</CardTitle>
          <CardDescription>
            Compare optimized vs unoptimized components. Open browser console to see render logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={() => setOptimizedView(!optimizedView)}
              variant={optimizedView ? "default" : "outline"}
            >
              {optimizedView ? '✅ Optimized View' : '🚫 Unoptimized View'}
            </Button>
            <Button onClick={() => setCounter(c => c + 1)} variant="outline">
              Force Re-render ({counter})
            </Button>
            <Button onClick={addItem} variant="outline">
              Add Item
            </Button>
            <Button onClick={removeLastItem} variant="outline" disabled={items.length === 0}>
              Remove Item
            </Button>
          </div>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Badge variant="outline">
              {filteredItems.length} of {items.length} items
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statistics Section */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>
              {optimizedView ? 'Using useMemo' : 'Without useMemo'} - check console for calculation logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatisticsDisplay stats={optimizedView ? optimizedStats : unoptimizedStats} />
          </CardContent>
        </Card>

        {/* Items List Section */}
        <Card>
          <CardHeader>
            <CardTitle>Items List</CardTitle>
            <CardDescription>
              {optimizedView ? 'Using React.memo & useCallback' : 'Without optimization'} - check console for render logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredItems.map(item => 
                optimizedView ? (
                  <OptimizedListItem
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateOptimized}
                    highlightColor={optimizedHighlightColor}
                  />
                ) : (
                  <UnoptimizedListItem
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateUnoptimized}
                    highlightColor={unoptimizedHighlightColor}
                  />
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">🔄 React.memo</h4>
              <p className="text-muted-foreground">
                Prevents re-renders when props haven't changed. Essential for list items.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">⚡ useMemo</h4>
              <p className="text-muted-foreground">
                Caches expensive calculations. Only recalculates when dependencies change.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">🎯 useCallback</h4>
              <p className="text-muted-foreground">
                Stabilizes function references to prevent unnecessary child re-renders.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDemoComponent;