import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Check, ClipboardCopy, Edit, Eye, Info, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RecipeIngredient {
  id: number;
  recipeId: number;
  materialId: number;
  materialName?: string;
  quantity: number;
  unit: 'liter' | 'kg' | 'piece';
  notes?: string;
}

interface Recipe {
  id: number;
  name: string;
  sku: string;
  description: string;
  productSku: string;
  productName: string;
  yield: number;
  yieldUnit: string;
  createdAt: string;
  updatedAt: string;
  createdById: number;
  createdBy?: string;
  status: string;
  ingredients: RecipeIngredient[];
  steps?: any[];
}

export default function RecipesList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ingredients');
  
  // Fetch recipes from API
  const { data: recipes, isLoading, error } = useQuery({
    queryKey: ['/api/production/recipes'],
    queryFn: async () => {
      const response = await apiRequest('/api/production/recipes');
      return response as Recipe[];
    }
  });
  
  useEffect(() => {
    if (error) {
      toast({
        title: t('errors.fetchFailed'),
        description: t('production.errorFetchingRecipes'),
        variant: 'destructive',
      });
    }
  }, [error, t, toast]);

  // Filter recipes based on search term
  const filteredRecipes = recipes?.filter(recipe => 
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.productSku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle viewing a recipe
  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setDialogOpen(true);
    setActiveTab('ingredients');
  };
  
  // Get status badge with appropriate color
  const getStatusBadge = (status: string) => {
    let variant = 'outline';
    
    if (status === 'active') variant = 'success';
    if (status === 'draft') variant = 'secondary';
    if (status === 'discontinued') variant = 'destructive';
    
    return (
      <Badge variant={variant as any}>{status}</Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/production">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <CardTitle>{t('production.recipesList')}</CardTitle>
                <CardDescription>{t('production.recipesDescription')}</CardDescription>
              </div>
            </div>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {t('production.addRecipe')}
          </Button>
        </div>
        <div className="flex mt-4">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('production.searchRecipes')}
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%]">{t('products.sku')}</TableHead>
                  <TableHead className="w-[25%]">{t('production.recipeName')}</TableHead>
                  <TableHead className="w-[20%]">{t('production.product')}</TableHead>
                  <TableHead className="w-[15%]">{t('production.yield')}</TableHead>
                  <TableHead className="w-[10%]">{t('production.status')}</TableHead>
                  <TableHead className="text-right w-[15%]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipes && filteredRecipes.length > 0 ? (
                  filteredRecipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium">{recipe.sku}</TableCell>
                      <TableCell>{recipe.name}</TableCell>
                      <TableCell>{recipe.productName}</TableCell>
                      <TableCell>
                        {recipe.yield} {t(`production.units.${recipe.yieldUnit}`)}
                      </TableCell>
                      <TableCell>{getStatusBadge(recipe.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewRecipe(recipe)}
                          className="mr-1"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-1"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <ClipboardCopy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      {searchTerm ? t('production.noRecipesFound') : t('production.noRecipesYet')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>
                {selectedRecipe?.name}
              </DialogTitle>
              <DialogDescription>
                {selectedRecipe?.description}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRecipe && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ingredients">{t('production.ingredients')}</TabsTrigger>
                  <TabsTrigger value="steps">{t('production.steps')}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="ingredients" className="mt-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50%]">{t('production.material')}</TableHead>
                          <TableHead className="w-[50%]">{t('production.quantity')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 ? (
                          selectedRecipe.ingredients.map((ingredient) => (
                            <TableRow key={ingredient.id}>
                              <TableCell className="font-medium">{ingredient.materialName}</TableCell>
                              <TableCell>
                                {ingredient.quantity} {t(`production.units.${ingredient.unit}`)}
                                {ingredient.notes && (
                                  <div className="text-xs text-muted-foreground flex items-center mt-1">
                                    <Info className="h-3 w-3 mr-1" />
                                    {ingredient.notes}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                              {t('production.noIngredientsFound')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                <TabsContent value="steps" className="mt-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[10%]">{t('production.step')}</TableHead>
                          <TableHead>{t('production.description')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRecipe.steps && selectedRecipe.steps.length > 0 ? (
                          selectedRecipe.steps.map((step: any) => (
                            <TableRow key={step.id}>
                              <TableCell className="font-medium">{step.order}</TableCell>
                              <TableCell>{step.description}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                              {t('production.noStepsFound')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
            
            <DialogFooter>
              <div className="flex flex-col xs:flex-row gap-2 mt-4 w-full items-start xs:items-center">
                <div className="flex-1 text-sm text-muted-foreground">
                  {selectedRecipe && (
                    <div>
                      <p>{t('production.product')}: {selectedRecipe.productName} ({selectedRecipe.productSku})</p>
                      <p>{t('production.yield')}: {selectedRecipe.yield} {t(`production.units.${selectedRecipe.yieldUnit}`)}</p>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('close')}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}