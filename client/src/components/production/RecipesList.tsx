import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Eye, Edit, Clipboard, ClipboardCopy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock data for demonstration
const mockRecipes = [
  {
    id: 1,
    name: 'Premium Extra Virgin Olive Oil 750ml',
    sku: 'RECIPE-EVOO-750',
    description: 'Premium quality extra virgin olive oil in 750ml glass bottles',
    productSku: 'PROD-EVOO-750',
    productName: 'Premium EVOO 750ml',
    yield: 950, // Expected production units from the recipe
    yieldUnit: 'bottle',
    createdAt: new Date('2024-02-15').toISOString(),
    updatedAt: new Date('2024-03-01').toISOString(),
    createdBy: 'Administrator',
    status: 'active',
    ingredients: [
      { id: 1, materialId: 1, materialName: 'Extra Virgin Olive Oil', quantity: 750, unit: 'liter' },
      { id: 2, materialId: 2, materialName: 'Clear Glass Bottle 750ml', quantity: 1000, unit: 'piece' },
      { id: 3, materialId: 3, materialName: 'Premium Cork Cap', quantity: 1000, unit: 'piece' },
      { id: 4, materialId: 4, materialName: 'Premium Label Design A', quantity: 1000, unit: 'piece' }
    ],
    steps: [
      { id: 1, order: 1, description: 'Prepare bottling machine and clean all equipment' },
      { id: 2, order: 2, description: 'Load olive oil into the filler tank' },
      { id: 3, order: 3, description: 'Set up bottles on the conveyor belt' },
      { id: 4, order: 4, description: 'Start bottling process, ensuring each bottle is filled to 750ml' },
      { id: 5, order: 5, description: 'Install cork caps on each bottle' },
      { id: 6, order: 6, description: 'Apply labels to each bottle' },
      { id: 7, order: 7, description: 'Inspect final product for quality assurance' },
      { id: 8, order: 8, description: 'Package bottles in appropriate boxes for storage' }
    ]
  },
  {
    id: 2,
    name: 'Organic Extra Virgin Olive Oil 500ml',
    sku: 'RECIPE-ORG-500',
    description: 'Organic certified extra virgin olive oil in 500ml glass bottles',
    productSku: 'PROD-ORG-500',
    productName: 'Organic EVOO 500ml',
    yield: 960, // Expected production units from the recipe
    yieldUnit: 'bottle',
    createdAt: new Date('2024-02-18').toISOString(),
    updatedAt: new Date('2024-03-05').toISOString(),
    createdBy: 'Administrator',
    status: 'active',
    ingredients: [
      { id: 5, materialId: 1, materialName: 'Extra Virgin Olive Oil', quantity: 500, unit: 'liter' },
      { id: 6, materialId: 6, materialName: 'Clear Glass Bottle 500ml', quantity: 1000, unit: 'piece' },
      { id: 7, materialId: 3, materialName: 'Premium Cork Cap', quantity: 1000, unit: 'piece' },
      { id: 8, materialId: 7, materialName: 'Organic Label Design', quantity: 1000, unit: 'piece' }
    ],
    steps: [
      { id: 9, order: 1, description: 'Prepare bottling machine and clean all equipment' },
      { id: 10, order: 2, description: 'Load organic olive oil into the filler tank' },
      { id: 11, order: 3, description: 'Set up 500ml bottles on the conveyor belt' },
      { id: 12, order: 4, description: 'Start bottling process, ensuring each bottle is filled to 500ml' },
      { id: 13, order: 5, description: 'Install cork caps on each bottle' },
      { id: 14, order: 6, description: 'Apply organic certification labels to each bottle' },
      { id: 15, order: 7, description: 'Inspect final product for quality assurance' },
      { id: 16, order: 8, description: 'Package bottles in appropriate boxes for storage' }
    ]
  },
  {
    id: 3,
    name: 'Gift Box 3x250ml Collection',
    sku: 'RECIPE-GIFT-3X250',
    description: 'Premium gift box with 3 varieties of olive oil in 250ml bottles',
    productSku: 'PROD-GIFT-3X250',
    productName: 'Gift Box Collection',
    yield: 450, // Expected production units from the recipe
    yieldUnit: 'box',
    createdAt: new Date('2024-02-20').toISOString(),
    updatedAt: new Date('2024-03-10').toISOString(),
    createdBy: 'Administrator',
    status: 'draft',
    ingredients: [
      { id: 9, materialId: 1, materialName: 'Extra Virgin Olive Oil', quantity: 250, unit: 'liter' },
      { id: 10, materialId: 8, materialName: 'Lemon Infused Olive Oil', quantity: 250, unit: 'liter' },
      { id: 11, materialId: 9, materialName: 'Herb Infused Olive Oil', quantity: 250, unit: 'liter' },
      { id: 12, materialId: 10, materialName: 'Clear Glass Bottle 250ml', quantity: 1500, unit: 'piece' },
      { id: 13, materialId: 11, materialName: 'Small Cork Cap', quantity: 1500, unit: 'piece' },
      { id: 14, materialId: 12, materialName: 'Classic Label 250ml', quantity: 500, unit: 'piece' },
      { id: 15, materialId: 13, materialName: 'Lemon Label 250ml', quantity: 500, unit: 'piece' },
      { id: 16, materialId: 14, materialName: 'Herb Label 250ml', quantity: 500, unit: 'piece' },
      { id: 17, materialId: 5, materialName: 'Gift Box for 3 Bottles', quantity: 500, unit: 'piece' }
    ],
    steps: [
      { id: 17, order: 1, description: 'Prepare bottling machine and clean all equipment' },
      { id: 18, order: 2, description: 'Bottle 250ml of classic olive oil' },
      { id: 19, order: 3, description: 'Clean equipment thoroughly before changing oil type' },
      { id: 20, order: 4, description: 'Bottle 250ml of lemon infused olive oil' },
      { id: 21, order: 5, description: 'Clean equipment thoroughly before changing oil type' },
      { id: 22, order: 6, description: 'Bottle 250ml of herb infused olive oil' },
      { id: 23, order: 7, description: 'Apply appropriate labels to each bottle type' },
      { id: 24, order: 8, description: 'Assemble gift boxes with one bottle of each type' },
      { id: 25, order: 9, description: 'Add promotional material and sealing sticker to each box' },
      { id: 26, order: 10, description: 'Inspect final product for quality assurance' }
    ]
  }
];

export default function RecipesList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [recipes, setRecipes] = useState(mockRecipes);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ingredients');
  
  const filteredRecipes = searchTerm 
    ? recipes.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : recipes;

  const handleViewRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
    setDialogOpen(true);
    setActiveTab('ingredients');
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'active': 'bg-green-100 text-green-800 border-green-300',
      'draft': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'archived': 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <Badge
        variant="outline"
        className={statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300'}
      >
        {t(`production.recipeStatus.${status}`)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('production.recipesList')}</CardTitle>
            <CardDescription>{t('production.recipesDescription')}</CardDescription>
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
              {filteredRecipes.length > 0 ? (
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
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="ingredients">{t('production.ingredients')}</TabsTrigger>
                  <TabsTrigger value="steps">{t('production.productionSteps')}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="ingredients" className="mt-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('production.materialName')}</TableHead>
                          <TableHead>{t('production.quantity')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRecipe.ingredients.map((ingredient: any) => (
                          <TableRow key={ingredient.id}>
                            <TableCell>{ingredient.materialName}</TableCell>
                            <TableCell>
                              {ingredient.quantity} {t(`production.units.${ingredient.unit}`)}
                            </TableCell>
                          </TableRow>
                        ))}
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
                        {selectedRecipe.steps.map((step: any) => (
                          <TableRow key={step.id}>
                            <TableCell className="font-medium">{step.order}</TableCell>
                            <TableCell>{step.description}</TableCell>
                          </TableRow>
                        ))}
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