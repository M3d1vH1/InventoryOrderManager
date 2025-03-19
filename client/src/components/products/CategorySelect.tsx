import React, { useEffect } from 'react';
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
 * A component for selecting categories with proper error handling and state management
 */
const CategorySelect = ({ value, onChange, description }: CategorySelectProps) => {
  const { t } = useTranslation();
  
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    staleTime: 10000,
  });
  
  // Debug
  console.log('CategorySelect - Current value:', value, 'Available categories:', categories);
  
  // Set default category when categories load and no value is selected
  useEffect(() => {
    if (categories.length > 0 && (!value || value === 0)) {
      console.log('CategorySelect - Setting default category:', categories[0].id);
      onChange(categories[0].id);
    }
  }, [categories, value, onChange]);
  
  return (
    <FormItem>
      <FormLabel>{t('products.category')}</FormLabel>
      {isLoading ? (
        <div className="flex items-center space-x-2 h-10 px-3 py-2 text-sm border border-slate-200 rounded-md">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading categories...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-sm text-amber-500 p-2 border border-amber-200 bg-amber-50 rounded-md">
          No categories available. Please create a category first.
        </div>
      ) : (
        <Select
          value={value ? String(value) : undefined}
          onValueChange={(val) => {
            const numValue = parseInt(val, 10);
            console.log('CategorySelect - Selected category:', numValue);
            onChange(numValue);
          }}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={t('products.selectCategory')} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem 
                key={category.id} 
                value={String(category.id)}
                className="flex items-center gap-2"
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
      )}
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
};

export default CategorySelect;