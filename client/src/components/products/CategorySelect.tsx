import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FormControl, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CategorySelectProps {
  value: number;
  onChange: (value: number) => void;
  description?: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

/**
 * Hard-coded simplified category component to debug the issue
 */
const CategorySelect = ({ value, onChange, description }: CategorySelectProps) => {
  const { t } = useTranslation();
  const [selectedValue, setSelectedValue] = useState<string>("");
  
  // Fetch categories directly
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  console.log('CategorySelect rendered with:', { value, categories, selectedValue });
  
  // Initialize selected value when categories load
  useEffect(() => {
    if (categories && categories.length > 0) {
      // If no valid category is selected, force select the first one
      if (!value || value === 0) {
        const firstCategoryId = categories[0].id;
        console.log('Setting default category to:', firstCategoryId);
        onChange(firstCategoryId);
        setSelectedValue(String(firstCategoryId));
      } else {
        // If we have a value already, sync it with local state
        setSelectedValue(String(value));
      }
    }
  }, [categories, value, onChange]);
  
  // When the select value changes
  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue);
    const numValue = parseInt(newValue, 10);
    console.log('User selected category:', numValue);
    onChange(numValue);
  };

  // Show loading state
  if (isLoading) {
    return (
      <FormItem>
        <FormLabel>{t('products.category')}</FormLabel>
        <div className="flex items-center space-x-2 h-10 px-3 py-2 text-sm border border-slate-200 rounded-md">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading categories...</span>
        </div>
        <FormMessage />
      </FormItem>
    );
  }

  // Show no categories warning
  if (categories.length === 0) {
    return (
      <FormItem>
        <FormLabel>{t('products.category')}</FormLabel>
        <div className="text-sm text-amber-500 p-2 border border-amber-200 bg-amber-50 rounded-md">
          No categories available. Please create a category first.
        </div>
        <FormMessage />
      </FormItem>
    );
  }

  // At this point we have categories
  console.log('CategorySelect rendering with selected value:', selectedValue);
  return (
    <FormItem>
      <FormLabel>{t('products.category')}</FormLabel>
      <Select
        value={selectedValue}
        onValueChange={handleValueChange}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={t('products.selectCategory')}>
              {/* Display the selected category name instead of ID */}
              {selectedValue && categories.find(c => c.id === parseInt(selectedValue))?.name}
            </SelectValue>
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem 
              key={category.id} 
              value={String(category.id)}
            >
              {category.color && (
                <span 
                  className="w-3 h-3 rounded-full inline-block mr-2" 
                  style={{ backgroundColor: category.color }}
                />
              )}
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
};

export default CategorySelect;