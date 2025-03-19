import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Pencil, Trash2, Save } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Define colors for quick selection
const CATEGORY_COLORS = [
  '#FDE68A', // Yellow
  '#A7F3D0', // Green
  '#BAE6FD', // Blue
  '#FED7AA', // Orange
  '#DDD6FE', // Purple
  '#FCA5A5', // Red
  '#FECACA', // Light Red
  '#BFDBFE', // Light Blue
  '#C7D2FE', // Indigo
  '#E9D5FF', // Violet
];

// Define zod schema for category form validation
const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  color: z.string().default('#BAE6FD'),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface Category {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
}

const CategoryManager = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  
  // Form setup
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#BAE6FD',
    }
  });
  
  // Query categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: () => apiRequest<Category[]>('/api/categories'),
  });
  
  // Mutation for creating a category
  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      console.log('Creating category with data:', values);
      return apiRequest<Category>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setOpen(false);
      form.reset();
      toast({
        title: t('categories.created'),
        description: t('categories.createdDescription'),
      });
    },
    onError: (error) => {
      console.error('Category creation error:', error);
      toast({
        title: t('categories.error'),
        description: error.message || "Failed to create category",
        variant: 'destructive',
      });
    }
  });
  
  // Mutation for updating a category
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: CategoryFormValues }) => {
      console.log('Updating category with data:', values);
      return apiRequest<Category>(`/api/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setOpen(false);
      setEditingCategory(null);
      form.reset();
      toast({
        title: t('categories.updated'),
        description: t('categories.updatedDescription'),
      });
    },
    onError: (error) => {
      console.error('Category update error:', error);
      toast({
        title: t('categories.error'),
        description: error.message || "Failed to update category",
        variant: 'destructive',
      });
    }
  });
  
  // Mutation for deleting a category
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/categories/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setDeletingCategory(null);
      toast({
        title: t('categories.deleted'),
        description: t('categories.deletedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('categories.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const onSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, values });
    } else {
      createMutation.mutate(values);
    }
  };
  
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      description: category.description || '',
      color: category.color || '#BAE6FD',
    });
    setOpen(true);
  };
  
  const handleDeleteCategory = (category: Category) => {
    setDeletingCategory(category);
  };
  
  const handleAddCategory = () => {
    setEditingCategory(null);
    form.reset({
      name: '',
      description: '',
      color: '#BAE6FD',
    });
    setOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <div>
          {/* Categories count or other details could go here */}
          {!isLoading && categories.length > 0 && (
            <p className="text-gray-500">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</p>
          )}
        </div>
        <Button onClick={handleAddCategory}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('categories.add')}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="loader">{t('common.loading')}</div>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">{t('categories.noCategories')}</h3>
          <Button onClick={handleAddCategory}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('categories.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center">
                    {category.color && (
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: category.color }}
                      ></div>
                    )}
                    {category.name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {category.description && <p className="text-gray-500">{category.description}</p>}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-0">
                <Button variant="outline" size="sm" onClick={() => handleEditCategory(category)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  {t('app.edit')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteCategory(category)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('app.delete')}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Category Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('categories.edit') : t('categories.add')}
            </DialogTitle>
            <DialogDescription>
              {t('categories.formDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categories.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('categories.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categories.description')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('categories.descriptionPlaceholder')} 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categories.color')}</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input type="color" {...field} className="w-12 h-10 p-1" />
                        <Input 
                          type="text" 
                          value={field.value} 
                          onChange={(e) => field.onChange(e.target.value)} 
                          className="ml-2 w-24" 
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      {t('categories.quickColors')}:
                    </FormDescription>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CATEGORY_COLORS.map((color) => (
                        <div
                          key={color}
                          className="w-8 h-8 rounded-md cursor-pointer border shadow-sm"
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                        ></div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>{t('common.saving')}</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingCategory ? t('categories.update') : t('categories.save')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('app.delete')} {deletingCategory?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('categories.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('app.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CategoryManager;