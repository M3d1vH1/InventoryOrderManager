import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2, Edit, Trash2, PaintBucket } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Interface for Category with color
interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

// Form validation schema
const categoryFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  color: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

// Define a list of suggested colors for one-click selection
const suggestedColors = [
  { name: "Red", value: "#FF5A5A" },
  { name: "Green", value: "#4CAF50" },
  { name: "Blue", value: "#5C7AEA" },
  { name: "Yellow", value: "#FFD700" },
  { name: "Purple", value: "#8E44AD" },
  { name: "Orange", value: "#FF9800" },
  { name: "Teal", value: "#009688" },
  { name: "Pink", value: "#E91E63" }
];

const CategoryManager = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Query to fetch categories
  const { data: categories = [] as Category[], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    staleTime: 15000,
  });
  
  // Form setup
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "",
    },
  });
  
  // Mutations for CRUD operations
  const createCategoryMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      return apiRequest({
        url: '/api/categories',
        method: 'POST',
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: t('categories.created'),
        description: t('categories.createdDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('categories.error'),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: CategoryFormValues }) => {
      return apiRequest({
        url: `/api/categories/${id}`,
        method: 'PATCH',
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsDialogOpen(false);
      setEditingCategory(null);
      form.reset();
      toast({
        title: t('categories.updated'),
        description: t('categories.updatedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('categories.error'),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/categories/${id}`,
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: t('categories.deleted'),
        description: t('categories.deletedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('categories.error'),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Event handlers
  const onSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, values });
    } else {
      createCategoryMutation.mutate(values);
    }
  };
  
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      description: category.description || "",
      color: category.color || "",
    });
    setIsDialogOpen(true);
  };
  
  const handleNewCategory = () => {
    setEditingCategory(null);
    form.reset({
      name: "",
      description: "",
      color: "",
    });
    setIsDialogOpen(true);
  };
  
  const handleDeleteCategory = (id: number) => {
    if (window.confirm(t('categories.confirmDelete'))) {
      deleteCategoryMutation.mutate(id);
    }
  };
  
  const handleColorSelect = (color: string) => {
    form.setValue("color", color);
  };

  const updateCategoryColor = (category: Category, color: string) => {
    updateCategoryMutation.mutate({ 
      id: category.id, 
      values: { ...category, color }
    });
  };
  
  return (
    <div>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>{t('categories.title')}</CardTitle>
            <CardDescription>{t('categories.description')}</CardDescription>
          </div>
          <Button onClick={handleNewCategory} className="flex items-center gap-1">
            <PlusCircle className="h-4 w-4" />
            {t('categories.add')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">{t('common.loading')}</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-slate-50">
              <p className="text-muted-foreground">{t('categories.noCategories')}</p>
              <Button onClick={handleNewCategory} variant="outline" className="mt-4">
                {t('categories.createFirst')}
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('categories.name')}</TableHead>
                    <TableHead>{t('categories.description')}</TableHead>
                    <TableHead>{t('categories.color')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {category.color ? (
                            <div 
                              className="w-6 h-6 rounded border border-gray-300" 
                              style={{ backgroundColor: category.color }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded border border-gray-300 bg-gray-100" />
                          )}
                          <div className="flex gap-1 flex-wrap">
                            {suggestedColors.map((color) => (
                              <button
                                key={color.value}
                                className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                                onClick={() => updateCategoryColor(category, color.value)}
                              />
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('categories.edit') : t('categories.add')}
            </DialogTitle>
            <DialogDescription>
              {t('categories.formDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                          className="resize-none h-20"
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
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="#RRGGBB"
                            {...field}
                            className="w-28"
                          />
                        </FormControl>
                        <Input
                          type="color"
                          value={field.value || "#FFFFFF"}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-12 h-8 p-0 border-none"
                        />
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-1">{t('categories.quickColors')}</p>
                        <div className="flex gap-1 flex-wrap">
                          {suggestedColors.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                              onClick={() => handleColorSelect(color.value)}
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createCategoryMutation.isPending || updateCategoryMutation.isPending
                    }
                  >
                    {createCategoryMutation.isPending || updateCategoryMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : editingCategory ? (
                      t('categories.update')
                    ) : (
                      t('categories.save')
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryManager;