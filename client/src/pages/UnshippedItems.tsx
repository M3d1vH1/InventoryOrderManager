import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import UnshippedItemsComponent from '@/components/orders/UnshippedItems';
import { Link } from 'wouter';

export default function UnshippedItemsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('unshippedItems.pageTitle')}</h1>
            <p className="text-muted-foreground max-w-4xl mt-2">
              {t('unshippedItems.pageDescription')}
            </p>
          </div>
          <Link href="/orders">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('common.backToOrders', 'Back to Orders')}
            </Button>
          </Link>
        </div>
        <Separator />

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="all">{t('unshippedItems.allItems')}</TabsTrigger>
            {hasPermission(['admin', 'manager']) && (
              <TabsTrigger value="pending-authorization">{t('unshippedItems.pendingAuthorization')}</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="all" className="pt-4">
            <UnshippedItemsComponent mode="all" />
          </TabsContent>
          {hasPermission(['admin', 'manager']) && (
            <TabsContent value="pending-authorization" className="pt-4">
              <UnshippedItemsComponent mode="pending-authorization" />
            </TabsContent>
          )}
        </Tabs>

        {activeTab === 'all' && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{t('unshippedItems.aboutTitle')}</CardTitle>
              <CardDescription>{t('unshippedItems.aboutDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">{t('unshippedItems.whatAreUnshippedItems')}</h3>
                  <p className="text-muted-foreground">
                    {t('unshippedItems.whatAreUnshippedItemsDescription')}
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">{t('unshippedItems.authorizationProcess')}</h3>
                  <p className="text-muted-foreground">
                    {t('unshippedItems.authorizationProcessDescription')}
                  </p>
                </div>
                {hasPermission(['admin', 'manager', 'front_office']) && (
                  <div>
                    <h3 className="text-lg font-medium">{t('unshippedItems.managersResponsibility')}</h3>
                    <p className="text-muted-foreground">
                      {t('unshippedItems.managersResponsibilityDescription')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}