// Performance optimization components exports
export { default as OptimizedProductRow } from './OptimizedProductRow';
export { default as OptimizedOrderRow } from './OptimizedOrderRow';
export { default as OptimizedInventory } from './OptimizedInventory';
export { default as PerformanceDemoComponent } from './PerformanceDemoComponent';

// Performance optimization utilities
export const performanceUtils = {
  /**
   * Debounce function for performance optimization
   */
  debounce: <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },

  /**
   * Throttle function for performance optimization
   */
  throttle: <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  },

  /**
   * Shallow comparison for React.memo
   */
  shallowEqual: (obj1: any, obj2: any): boolean => {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) {
      return false;
    }
    
    for (let key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }
    
    return true;
  },

  /**
   * Log performance metrics
   */
  logPerformance: (componentName: string, renderCount: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 ${componentName} rendered ${renderCount} times`);
    }
  }
};