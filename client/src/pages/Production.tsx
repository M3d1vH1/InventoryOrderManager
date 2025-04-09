import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Input 
} from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { 
  ArrowDownUp, 
  ArrowRight,
  ArrowLeft, 
  Info, 
  Search, 
  Package, 
  FlaskConical, 
  Factory, 
  ClipboardList, 
  AlertCircle,
  HelpCircle,
  Filter,
  Check,
  Clock,
  Loader,
  Plus,
  FileCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import RawMaterialsList from '@/components/production/RawMaterialsList';
import RecipesList from '@/components/production/RecipesList';
import ProductionBatchesList from '@/components/production/ProductionBatchesList';
import ProductionOrdersList from '@/components/production/ProductionOrdersList';

// Mock data for quick stats
const quickStats = {
  materials: {
    total: 25,
    lowStock: 3,
    outOfStock: 1,
    recentlyAdded: 2
  },
  recipes: {
    total: 8,
    active: 5,
    draft: 2,
    archived: 1
  },
  batches: {
    total: 12,
    inProgress: 2,
    completed: 8,
    planned: 2
  },
  orders: {
    total: 15,
    pending: 3,
    inProgress: 2,
    completed: 10
  }
};

export default function Production() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [helpSection, setHelpSection] = useState<TutorialSections>('overview');

  // For production workflow process
  const processSteps = [
    { 
      id: 'materials', 
      name: t('production.rawMaterials'),
      icon: <Package className="h-5 w-5" />,
      description: t('production.flowMaterialsDescription') || 'Manage raw materials inventory for production',
      color: 'bg-blue-100 border-blue-200 text-blue-800'
    },
    { 
      id: 'recipes', 
      name: t('production.recipes'),
      icon: <FlaskConical className="h-5 w-5" />,
      description: t('production.flowRecipesDescription') || 'Create and manage product recipes and formulas',
      color: 'bg-purple-100 border-purple-200 text-purple-800'
    },
    { 
      id: 'batches', 
      name: t('production.batches'),
      icon: <Factory className="h-5 w-5" />,
      description: t('production.flowBatchesDescription') || 'Schedule and track production batches',
      color: 'bg-amber-100 border-amber-200 text-amber-800'
    },
    { 
      id: 'orders', 
      name: t('production.orders'),
      icon: <ClipboardList className="h-5 w-5" />,
      description: t('production.flowOrdersDescription') || 'Manage production orders from start to finish',
      color: 'bg-green-100 border-green-200 text-green-800'
    },
  ];

  // For production workflow tutorial
  type TutorialSections = 'overview' | 'materials' | 'recipes' | 'batches' | 'orders' | 'workflow';
  
  const tutorials: Record<TutorialSections, { title: string; content: string }> = {
    overview: {
      title: t('production.tutorialOverviewTitle') || 'Production Module Overview',
      content: t('production.tutorialOverviewContent') || 'This module helps you manage the entire production process from raw materials to finished products. Use the visual workflow to navigate between different production stages.'
    },
    materials: {
      title: t('production.tutorialMaterialsTitle') || 'Managing Raw Materials',
      content: t('production.tutorialMaterialsContent') || 'Add and track your raw materials inventory. Set minimum stock levels to get alerts when materials are running low.'
    },
    recipes: {
      title: t('production.tutorialRecipesTitle') || 'Creating Production Recipes',
      content: t('production.tutorialRecipesContent') || 'Create recipes that define how raw materials are transformed into finished products. Specify ingredients and step-by-step instructions.'
    },
    batches: {
      title: t('production.tutorialBatchesTitle') || 'Planning Production Batches',
      content: t('production.tutorialBatchesContent') || 'Schedule production batches to produce your products. Track batch progress and manage production schedules.'
    },
    orders: {
      title: t('production.tutorialOrdersTitle') || 'Managing Production Orders',
      content: t('production.tutorialOrdersContent') || 'Create and track production orders based on your recipes. Monitor production progress and manage completion.'
    },
    workflow: {
      title: t('production.tutorialWorkflowTitle') || 'Creating a New Production Workflow',
      content: t('production.tutorialWorkflowContent') || 'Start by adding raw materials, then create recipes using those materials. Next, schedule production batches and create production orders to track the process.'
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('production.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('production.subtitle') || "Track and manage the production process from raw materials to finished products"}
          </p>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowTutorial(true)}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  {t('production.help') || "Help"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('production.helpTooltip') || "Get help with the production module"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <AlertDialog open={showTutorial} onOpenChange={setShowTutorial}>
            <AlertDialogContent className="max-w-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  {tutorials[helpSection].title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  {tutorials[helpSection].content}
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-4">
                <Button 
                  variant={helpSection === 'overview' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setHelpSection('overview')}
                >
                  {t('production.tutorialOverview') || "Overview"}
                </Button>
                <Button 
                  variant={helpSection === 'materials' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setHelpSection('materials')}
                >
                  {t('production.rawMaterials')}
                </Button>
                <Button 
                  variant={helpSection === 'recipes' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setHelpSection('recipes')}
                >
                  {t('production.recipes')}
                </Button>
                <Button 
                  variant={helpSection === 'batches' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setHelpSection('batches')}
                >
                  {t('production.batches')}
                </Button>
                <Button 
                  variant={helpSection === 'orders' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setHelpSection('orders')}
                >
                  {t('production.orders')}
                </Button>
                <Button 
                  variant={helpSection === 'workflow' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setHelpSection('workflow')}
                >
                  {t('production.tutorialWorkflow') || "Workflow"}
                </Button>
              </div>
              
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t('close')}
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('production.createNewProduction') || "New Production"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('production.newProductionTitle') || "Create New Production"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('production.newProductionDescription') || "What would you like to create?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                {processSteps.map((step) => (
                  <Button 
                    key={step.id} 
                    variant="outline" 
                    className="h-auto py-4 px-4 flex flex-col items-center justify-center text-center gap-2"
                    onClick={() => {
                      setActiveTab(step.id);
                    }}
                  >
                    <div className={`p-3 rounded-full ${step.color}`}>
                      {step.icon}
                    </div>
                    <span className="font-medium">{step.name}</span>
                    <span className="text-xs text-muted-foreground">{step.description}</span>
                  </Button>
                ))}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      {/* Visual Process Flow Diagram */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <TooltipProvider>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-2">
              {processSteps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeTab === step.id ? "default" : "outline"}
                        className={`flex-col h-24 w-36 gap-1 ${activeTab === step.id ? 'border-2' : ''}`}
                        onClick={() => setActiveTab(step.id)}
                      >
                        <div className="text-primary">
                          {step.icon}
                        </div>
                        <span className="text-xs font-medium mt-1">{step.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-medium">{step.name}</p>
                      <p className="text-xs mt-1">{step.description}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {index < processSteps.length - 1 && (
                    <div className="hidden md:flex mx-2">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
      
      {/* Dashboard Overview with Quick Stat Cards */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight mb-4">
            {t('production.dashboardTitle') || "Production Dashboard"}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {processSteps.map((step) => (
              <Card 
                key={step.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setActiveTab(step.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center text-base">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-full ${step.color}`}>
                        {step.icon}
                      </div>
                      {step.name}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {step.id === 'materials' && (
                      <>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold">{quickStats.materials.total}</span>
                          <span className="text-xs text-muted-foreground">{t('production.totalMaterials') || "Total Materials"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-yellow-600">{quickStats.materials.lowStock}</span>
                          <span className="text-xs text-muted-foreground">{t('production.lowStockMaterials') || "Low Stock"}</span>
                        </div>
                      </>
                    )}
                    
                    {step.id === 'recipes' && (
                      <>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold">{quickStats.recipes.total}</span>
                          <span className="text-xs text-muted-foreground">{t('production.totalRecipes') || "Total Recipes"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-green-600">{quickStats.recipes.active}</span>
                          <span className="text-xs text-muted-foreground">{t('production.activeRecipes') || "Active Recipes"}</span>
                        </div>
                      </>
                    )}
                    
                    {step.id === 'batches' && (
                      <>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold">{quickStats.batches.total}</span>
                          <span className="text-xs text-muted-foreground">{t('production.totalBatches') || "Total Batches"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-amber-600">{quickStats.batches.inProgress}</span>
                          <span className="text-xs text-muted-foreground">{t('production.inProgressBatches') || "In Progress"}</span>
                        </div>
                      </>
                    )}
                    
                    {step.id === 'orders' && (
                      <>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold">{quickStats.orders.total}</span>
                          <span className="text-xs text-muted-foreground">{t('production.totalOrders') || "Total Orders"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-blue-600">{quickStats.orders.pending}</span>
                          <span className="text-xs text-muted-foreground">{t('production.pendingOrders') || "Pending"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  {step.id === 'materials' && quickStats.materials.lowStock > 0 && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {t('production.lowStockWarning', { count: quickStats.materials.lowStock }) || `${quickStats.materials.lowStock} materials low in stock`}
                    </Badge>
                  )}
                  
                  {step.id === 'recipes' && quickStats.recipes.draft > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300">
                      <Info className="h-3 w-3 mr-1" />
                      {t('production.draftRecipesInfo', { count: quickStats.recipes.draft }) || `${quickStats.recipes.draft} draft recipes`}
                    </Badge>
                  )}
                  
                  {step.id === 'batches' && quickStats.batches.planned > 0 && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('production.plannedBatchesInfo', { count: quickStats.batches.planned }) || `${quickStats.batches.planned} batches planned`}
                    </Badge>
                  )}
                  
                  {step.id === 'orders' && quickStats.orders.inProgress > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300">
                      <Loader className="h-3 w-3 mr-1" />
                      {t('production.ordersInProgressInfo', { count: quickStats.orders.inProgress }) || `${quickStats.orders.inProgress} orders in progress`}
                    </Badge>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>{t('production.productionGuide') || "Production Guide"}</CardTitle>
              <CardDescription>{t('production.productionGuideDescription') || "Follow these steps to manage your production process"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">1</Badge>
                      {t('production.step1Title') || "Manage Raw Materials"}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-8">
                      <p>{t('production.step1Description') || "Before starting production, ensure you have all necessary raw materials in stock."}</p>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>{t('production.step1Bullet1') || "Add all raw materials used in production"}</li>
                        <li>{t('production.step1Bullet2') || "Set minimum stock levels to get alerts when materials are running low"}</li>
                        <li>{t('production.step1Bullet3') || "Update quantities when new materials arrive"}</li>
                      </ul>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setActiveTab('materials')}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        {t('production.goToMaterials') || "Go to Materials"}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800 border-purple-300">2</Badge>
                      {t('production.step2Title') || "Create Recipes"}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-8">
                      <p>{t('production.step2Description') || "Create detailed recipes that define how raw materials are transformed into finished products."}</p>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>{t('production.step2Bullet1') || "Define required raw materials and quantities"}</li>
                        <li>{t('production.step2Bullet2') || "Specify step-by-step production instructions"}</li>
                        <li>{t('production.step2Bullet3') || "Set expected yield for finished products"}</li>
                      </ul>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setActiveTab('recipes')}
                      >
                        <FlaskConical className="h-4 w-4 mr-2" />
                        {t('production.goToRecipes') || "Go to Recipes"}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">3</Badge>
                      {t('production.step3Title') || "Schedule Production Batches"}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-8">
                      <p>{t('production.step3Description') || "Plan and schedule production batches to organize your production process."}</p>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>{t('production.step3Bullet1') || "Create production batches with start and end dates"}</li>
                        <li>{t('production.step3Bullet2') || "Allocate resources and capacity for each batch"}</li>
                        <li>{t('production.step3Bullet3') || "Monitor batch progress and status"}</li>
                      </ul>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setActiveTab('batches')}
                      >
                        <Factory className="h-4 w-4 mr-2" />
                        {t('production.goToBatches') || "Go to Batches"}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 border-green-300">4</Badge>
                      {t('production.step4Title') || "Manage Production Orders"}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-8">
                      <p>{t('production.step4Description') || "Create and track production orders to manage the entire production workflow."}</p>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>{t('production.step4Bullet1') || "Create production orders based on specific recipes"}</li>
                        <li>{t('production.step4Bullet2') || "Track progress through production stages"}</li>
                        <li>{t('production.step4Bullet3') || "Record actual quantities produced and material consumption"}</li>
                      </ul>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setActiveTab('orders')}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        {t('production.goToOrders') || "Go to Orders"}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Main tabs content with improved filtering */}
      {activeTab !== 'dashboard' && (
        <div className="space-y-4">
          <div className="flex items-center mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back') || "Back"}
            </Button>
            <div className="ml-2 pl-2 border-l">
              <span className="text-sm text-muted-foreground">
                {processSteps.find(step => step.id === activeTab)?.name}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t(`production.search${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`) || `Search ${activeTab}...`}
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={filterCategory} 
                onValueChange={setFilterCategory}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('production.filterCategory') || "Filter Category"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('production.allCategories') || "All Categories"}</SelectItem>
                  
                  {activeTab === 'materials' && (
                    <>
                      <SelectItem value="olive">{t('production.materialTypes.olive') || "Olive Oil"}</SelectItem>
                      <SelectItem value="bottle">{t('production.materialTypes.bottle') || "Bottles"}</SelectItem>
                      <SelectItem value="cap">{t('production.materialTypes.cap') || "Caps"}</SelectItem>
                      <SelectItem value="label">{t('production.materialTypes.label') || "Labels"}</SelectItem>
                      <SelectItem value="box">{t('production.materialTypes.box') || "Boxes"}</SelectItem>
                      <SelectItem value="lowStock">{t('production.lowStock') || "Low Stock"}</SelectItem>
                    </>
                  )}
                  
                  {activeTab === 'recipes' && (
                    <>
                      <SelectItem value="active">{t('production.recipeStatus.active') || "Active"}</SelectItem>
                      <SelectItem value="draft">{t('production.recipeStatus.draft') || "Draft"}</SelectItem>
                      <SelectItem value="archived">{t('production.recipeStatus.archived') || "Archived"}</SelectItem>
                    </>
                  )}
                  
                  {activeTab === 'batches' && (
                    <>
                      <SelectItem value="planned">{t('production.batchStatus.planned') || "Planned"}</SelectItem>
                      <SelectItem value="in_progress">{t('production.batchStatus.in_progress') || "In Progress"}</SelectItem>
                      <SelectItem value="completed">{t('production.batchStatus.completed') || "Completed"}</SelectItem>
                      <SelectItem value="quality_check">{t('production.batchStatus.quality_check') || "Quality Check"}</SelectItem>
                    </>
                  )}
                  
                  {activeTab === 'orders' && (
                    <>
                      <SelectItem value="planned">{t('production.orderStatus.planned') || "Planned"}</SelectItem>
                      <SelectItem value="material_check">{t('production.orderStatus.material_check') || "Material Check"}</SelectItem>
                      <SelectItem value="in_progress">{t('production.orderStatus.in_progress') || "In Progress"}</SelectItem>
                      <SelectItem value="completed">{t('production.orderStatus.completed') || "Completed"}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              
              <Button variant="ghost" size="icon" onClick={() => {
                setSearchTerm('');
                setFilterCategory('all');
              }} title={t('production.clearFilters') || "Clear filters"}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {activeTab === 'materials' && <RawMaterialsList />}
          {activeTab === 'recipes' && <RecipesList />}
          {activeTab === 'batches' && <ProductionBatchesList />}
          {activeTab === 'orders' && <ProductionOrdersList />}
        </div>
      )}
      
      {/* Production Workflow Guidance */}
      {(activeTab === 'materials' || activeTab === 'recipes' || activeTab === 'batches' || activeTab === 'orders') && (
        <Card className="border-dashed mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <FileCheck className="h-4 w-4 mr-2 text-primary" />
              {t('production.quickTips') || "Quick Tips"}: {processSteps.find(step => step.id === activeTab)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {activeTab === 'materials' && (
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.materialsTip1') || "Set accurate minimum stock levels to get timely alerts"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.materialsTip2') || "Include supplier information for easy reordering"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.materialsTip3') || "Use the same units consistently to avoid conversion errors"}</span>
                </li>
              </ul>
            )}
            
            {activeTab === 'recipes' && (
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.recipesTip1') || "Include detailed step-by-step instructions for consistent results"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.recipesTip2') || "Specify exact quantities of materials needed for accurate inventory planning"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.recipesTip3') || "Document expected yield to track production efficiency"}</span>
                </li>
              </ul>
            )}
            
            {activeTab === 'batches' && (
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.batchesTip1') || "Schedule production during optimal times (seasonal considerations)"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.batchesTip2') || "Create batches of appropriate size for your equipment capacity"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.batchesTip3') || "Update batch status in real-time to maintain accurate production tracking"}</span>
                </li>
              </ul>
            )}
            
            {activeTab === 'orders' && (
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.ordersTip1') || "Link production orders to specific batches for better traceability"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.ordersTip2') || "Record actual production quantities to track losses and efficiency"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>{t('production.ordersTip3') || "Use the production log to document issues and improvements for future reference"}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      
      <div className="mt-6 text-xs text-muted-foreground">
        <p>{t('production.footerInfo')}</p>
      </div>
    </div>
  );
}