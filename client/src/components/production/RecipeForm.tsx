import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RecipeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecipe?: any;
}

const recipeSchema = z.object({
  name: z.string().min(2, 'production.recipeNameRequired'),
  sku: z.string().min(2, 'production.recipeSkuRequired'),
  description: z.string().optional(),
  productSku: z.string().min(2, 'production.productSkuRequired'),
  productName: z.string().min(2, 'production.productNameRequired'),
  yield: z.number().min(1, 'production.yieldRequired'),
  yieldUnit: z.string().min(1, 'production.yieldUnitRequired'),
  status: z.string().min(1, 'production.statusRequired')
});

export default function RecipeForm({ open, onOpenChange, editingRecipe }: RecipeFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [ingredientQuantity, setIngredientQuantity] = useState<string>('');
  const [ingredientUnit, setIngredientUnit] = useState<string>('kg');
  const [ingredientNotes, setIngredientNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!editingRecipe;

  // Fetch raw materials for ingredients
  const { data: materials } = useQuery({
    queryKey: ['/api/production/raw-materials'],
    queryFn: async () => {
      const response = await apiRequest('/api/production/raw-materials');
      return response as any[];
    }
  });

  // Initialize form with default values
  const form = useForm({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: editingRecipe?.name || '',
      sku: editingRecipe?.sku || '',
      description: editingRecipe?.description || '',
      productSku: editingRecipe?.productSku || '',
      productName: editingRecipe?.productName || '',
      yield: editingRecipe?.yield || 1,
      yieldUnit: editingRecipe?.yieldUnit || 'liter',
      status: editingRecipe?.status || 'active'
    }
  });

  // Set ingredients when editing
  useEffect(() => {
    if (editingRecipe?.ingredients && editingRecipe.ingredients.length > 0) {
      setIngredients(editingRecipe.ingredients);
    }
  }, [editingRecipe]);

  // Handle adding an ingredient
  const handleAddIngredient = () => {
    if (!selectedMaterial || !ingredientQuantity || !ingredientUnit) {
      setError(t('production.allFieldsRequired'));
      return;
    }

    const quantity = parseFloat(ingredientQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      setError(t('production.quantityMustBePositive'));
      return;
    }

    // Find the selected material to get its details
    const material = materials?.find((m: any) => m.id.toString() === selectedMaterial);
    
    const newIngredient = {
      materialId: parseInt(selectedMaterial),
      materialName: material?.name || 'Unknown Material',
      quantity,
      unit: ingredientUnit,
      notes: ingredientNotes
    };

    setIngredients([...ingredients, newIngredient]);
    setSelectedMaterial('');
    setIngredientQuantity('');
    setIngredientUnit('kg');
    setIngredientNotes('');
    setError(null);
    setShowIngredientForm(false);
  };

  // Handle removing an ingredient
  const handleRemoveIngredient = (index: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
  };

  // Create recipe mutation
  const createRecipeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/production/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: t('production.recipeCreated'),
        description: t('production.recipeCreatedSuccessfully')
      });
      queryClient.invalidateQueries({ queryKey: ['/api/production/recipes'] });
      onOpenChange(false);
      form.reset();
      setIngredients([]);
    },
    onError: (error: any) => {
      toast({
        title: t('errors.saveFailed'),
        description: error.message || t('production.failedToCreateRecipe'),
        variant: 'destructive',
      });
    }
  });

  // Update recipe mutation
  const updateRecipeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/production/recipes/${editingRecipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: t('production.recipeUpdated'),
        description: t('production.recipeUpdatedSuccessfully'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/production/recipes'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('errors.saveFailed'),
        description: error.message || t('production.failedToUpdateRecipe'),
        variant: 'destructive',
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: any) => {
    // Ensure yield is a number
    const formattedData = {
      ...data,
      yield: typeof data.yield === 'string' ? parseFloat(data.yield) : data.yield
    };

    if (ingredients.length === 0) {
      toast({
        title: t('production.noIngredients'),
        description: t('production.pleaseAddIngredients'),
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      recipe: formattedData,
      ingredients: ingredients
    };

    if (isEditing) {
      updateRecipeMutation.mutate(payload);
    } else {
      createRecipeMutation.mutate(payload);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? t('production.editRecipe') : t('production.addRecipe')}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? t('production.editRecipeDescription') : t('production.addRecipeDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('production.recipeName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('production.recipeNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('products.sku')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('production.recipeSkuPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.description')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('production.descriptionPlaceholder')} 
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productSku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('production.productSku')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('production.productSkuPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('production.productName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('production.productNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="yield"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('production.yield')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0.1" 
                          step="0.1" 
                          placeholder={t('production.yieldPlaceholder')} 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="yieldUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('production.yieldUnit')}</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('production.selectUnit')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="liter">{t('production.units.liter')}</SelectItem>
                          <SelectItem value="kg">{t('production.units.kg')}</SelectItem>
                          <SelectItem value="piece">{t('production.units.piece')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('production.status')}</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('production.selectStatus')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">{t('production.status.draft')}</SelectItem>
                          <SelectItem value="active">{t('production.status.active')}</SelectItem>
                          <SelectItem value="discontinued">{t('production.status.discontinued')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>{t('production.ingredients')}</CardTitle>
                      <CardDescription>{t('production.ingredientsDescription')}</CardDescription>
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowIngredientForm(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('production.addIngredient')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showIngredientForm && (
                    <div className="mb-4 p-4 border rounded-md">
                      <h3 className="text-sm font-medium mb-2">{t('production.newIngredient')}</h3>
                      {error && (
                        <Alert variant="destructive" className="mb-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <FormLabel>{t('production.material')}</FormLabel>
                          <Select 
                            value={selectedMaterial} 
                            onValueChange={setSelectedMaterial}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('production.selectMaterial')} />
                            </SelectTrigger>
                            <SelectContent>
                              {materials?.map((material: any) => (
                                <SelectItem key={material.id} value={material.id.toString()}>
                                  {material.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FormLabel>{t('production.quantity')}</FormLabel>
                          <Input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={ingredientQuantity}
                            onChange={(e) => setIngredientQuantity(e.target.value)}
                            placeholder={t('production.quantityPlaceholder')}
                          />
                        </div>
                        <div>
                          <FormLabel>{t('production.unit')}</FormLabel>
                          <Select 
                            value={ingredientUnit} 
                            onValueChange={setIngredientUnit}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('production.selectUnit')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="liter">{t('production.units.liter')}</SelectItem>
                              <SelectItem value="kg">{t('production.units.kg')}</SelectItem>
                              <SelectItem value="piece">{t('production.units.piece')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FormLabel>{t('production.notes')}</FormLabel>
                          <Input
                            value={ingredientNotes}
                            onChange={(e) => setIngredientNotes(e.target.value)}
                            placeholder={t('production.notesPlaceholder')}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end mt-3 space-x-2">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setShowIngredientForm(false);
                            setError(null);
                          }}
                        >
                          {t('cancel')}
                        </Button>
                        <Button 
                          type="button"
                          size="sm" 
                          onClick={handleAddIngredient}
                        >
                          {t('production.addIngredient')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Ingredients Table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('production.material')}</TableHead>
                          <TableHead>{t('production.quantity')}</TableHead>
                          <TableHead>{t('production.notes')}</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ingredients.length > 0 ? (
                          ingredients.map((ingredient, index) => (
                            <TableRow key={index}>
                              <TableCell>{ingredient.materialName}</TableCell>
                              <TableCell>
                                {ingredient.quantity} {t(`production.units.${ingredient.unit}`)}
                              </TableCell>
                              <TableCell>{ingredient.notes}</TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveIngredient(index)}
                                >
                                  <Trash className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                              {t('production.noIngredientsAdded')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {ingredients.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('production.ingredientsRequiredHint')}
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => {
                    onOpenChange(false);
                    form.reset();
                    setIngredients([]);
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button 
                  type="submit"
                  disabled={createRecipeMutation.isPending || updateRecipeMutation.isPending}
                >
                  {(createRecipeMutation.isPending || updateRecipeMutation.isPending) 
                    ? t('saving') 
                    : (isEditing ? t('save') : t('create'))}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}