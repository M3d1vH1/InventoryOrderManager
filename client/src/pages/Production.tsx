import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowDownUp } from 'lucide-react';

import RawMaterialsList from '@/components/production/RawMaterialsList';
import RecipesList from '@/components/production/RecipesList';
import ProductionBatchesList from '@/components/production/ProductionBatchesList';
import ProductionOrdersList from '@/components/production/ProductionOrdersList';

export default function Production() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('materials');
  const [flowDirection, setFlowDirection] = useState('vertical');

  const toggleFlowDirection = () => {
    setFlowDirection(flowDirection === 'vertical' ? 'horizontal' : 'vertical');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('production.title')}
        </h1>
        <Button 
          variant="outline" 
          size="sm"
          onClick={toggleFlowDirection}
          title={t('production.toggleView')}
        >
          <ArrowDownUp className="h-4 w-4 mr-2" />
          {flowDirection === 'vertical' 
            ? t('production.horizontalView') 
            : t('production.verticalView')}
        </Button>
      </div>
      
      <Tabs 
        defaultValue="materials" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 max-w-lg mb-4">
          <TabsTrigger value="materials">
            {t('production.rawMaterials')}
          </TabsTrigger>
          <TabsTrigger value="recipes">
            {t('production.recipes')}
          </TabsTrigger>
          <TabsTrigger value="batches">
            {t('production.batches')}
          </TabsTrigger>
          <TabsTrigger value="orders">
            {t('production.orders')}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="mt-0">
          <RawMaterialsList />
        </TabsContent>
        
        <TabsContent value="recipes" className="mt-0">
          <RecipesList />
        </TabsContent>
        
        <TabsContent value="batches" className="mt-0">
          <ProductionBatchesList />
        </TabsContent>
        
        <TabsContent value="orders" className="mt-0">
          <ProductionOrdersList />
        </TabsContent>
      </Tabs>
      
      {flowDirection === 'horizontal' && (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('production.rawMaterials')}</h2>
              <RawMaterialsList />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('production.recipes')}</h2>
              <RecipesList />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('production.batches')}</h2>
              <ProductionBatchesList />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('production.orders')}</h2>
              <ProductionOrdersList />
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 text-sm text-muted-foreground">
        <p>{t('production.footerInfo')}</p>
      </div>
    </div>
  );
}