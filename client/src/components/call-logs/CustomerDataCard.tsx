import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Order, Package, ShoppingCart, MapPin, Phone, Mail, Building, Info, Clock, FileText } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';

interface CustomerDataCardProps {
  customerId?: number | null;
  prospectiveCustomerId?: number | null;
  customerName?: string;
}

const CustomerDataCard: React.FC<CustomerDataCardProps> = ({ 
  customerId, 
  prospectiveCustomerId,
  customerName 
}) => {
  const { t, i18n } = useTranslation();
  const isGreek = i18n.language === 'el';
  
  // If no customer ID or prospective customer ID is provided, don't fetch any data
  if (!customerId && !prospectiveCustomerId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center">
            <Info className="h-4 w-4 mr-2" />
            {t('callLogs.customerInfo')}
          </CardTitle>
          <CardDescription>
            {customerName ? customerName : t('callLogs.noCustomerSelected')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{t('callLogs.noCustomerData')}</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch customer data (for registered customers)
  const { 
    data: customer, 
    isLoading: isLoadingCustomer,
    isError: isCustomerError
  } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch customer data');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching customer:', error);
        return null;
      }
    },
    enabled: !!customerId,
  });
  
  // Fetch prospective customer data
  const { 
    data: prospectiveCustomer, 
    isLoading: isLoadingProspective,
    isError: isProspectiveError
  } = useQuery({
    queryKey: [`/api/prospective-customers/${prospectiveCustomerId}`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/prospective-customers/${prospectiveCustomerId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch prospective customer data');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching prospective customer:', error);
        return null;
      }
    },
    enabled: !!prospectiveCustomerId,
  });
  
  // Fetch recent orders for the customer
  const { 
    data: recentOrders, 
    isLoading: isLoadingOrders,
    isError: isOrdersError
  } = useQuery({
    queryKey: [`/api/customers/${customerId}/orders`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}/orders?limit=5`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
      }
    },
    enabled: !!customerId,
  });
  
  // Fetch recent call logs for the customer or prospective customer
  const { 
    data: recentCalls, 
    isLoading: isLoadingCalls,
    isError: isCallsError
  } = useQuery({
    queryKey: [
      customerId 
        ? `/api/customers/${customerId}/call-logs` 
        : `/api/prospective-customers/${prospectiveCustomerId}/call-logs`
    ],
    queryFn: async () => {
      try {
        const endpoint = customerId 
          ? `/api/customers/${customerId}/call-logs?limit=5` 
          : `/api/prospective-customers/${prospectiveCustomerId}/call-logs?limit=5`;
          
        const response = await fetch(endpoint, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch call logs');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching call logs:', error);
        return [];
      }
    },
    enabled: !!(customerId || prospectiveCustomerId),
  });
  
  // Loading state
  if ((customerId && isLoadingCustomer) || (prospectiveCustomerId && isLoadingProspective)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">
            <Skeleton className="h-5 w-1/3" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-1/2" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if ((customerId && isCustomerError) || (prospectiveCustomerId && isProspectiveError)) {
    return (
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium text-red-600 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            {t('common.error')}
          </CardTitle>
          <CardDescription>
            {t('callLogs.errorFetchingCustomerData')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('common.tryAgainLater')}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Determine which data we're showing
  const customerData = customerId ? customer : prospectiveCustomer;
  const isProspect = !!prospectiveCustomerId;
  
  if (!customerData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center">
            <Info className="h-4 w-4 mr-2" />
            {isProspect ? t('callLogs.prospectCustomerInfo') : t('callLogs.customerInfo')}
          </CardTitle>
          <CardDescription>
            {t('callLogs.noCustomerSelected')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('callLogs.customerDataUnavailable')}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Format date taking into account i18n
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPP', {
        locale: isGreek ? el : undefined
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return dateString;
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center">
          {isProspect ? (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('callLogs.prospectCustomerInfo')}
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('callLogs.customerInfo')}
            </>
          )}
        </CardTitle>
        <CardDescription>
          {customerData.name || customerData.companyName || t('common.unnamed')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-1">
        <Tabs defaultValue="info">
          <TabsList className="mb-2 w-full grid grid-cols-3">
            <TabsTrigger value="info">{t('common.info')}</TabsTrigger>
            {!isProspect && <TabsTrigger value="orders">{t('common.orders')}</TabsTrigger>}
            <TabsTrigger value="calls">{t('callLogs.calls')}</TabsTrigger>
          </TabsList>
          
          {/* Basic Info Tab */}
          <TabsContent value="info" className="space-y-2 text-sm">
            {customerData.companyName && (
              <div className="flex items-start">
                <Building className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{customerData.companyName}</span>
              </div>
            )}
            
            {customerData.phone && (
              <div className="flex items-start">
                <Phone className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <a href={`tel:${customerData.phone}`} className="hover:underline">
                    {customerData.phone}
                  </a>
                </span>
              </div>
            )}
            
            {customerData.email && (
              <div className="flex items-start">
                <Mail className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <a href={`mailto:${customerData.email}`} className="hover:underline">
                    {customerData.email}
                  </a>
                </span>
              </div>
            )}
            
            {(customerData.address || customerData.city) && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  {[customerData.address, customerData.city].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            
            {isProspect && prospectiveCustomer.status && (
              <div className="flex items-start mt-2">
                <span className="text-muted-foreground mr-2">{t('callLogs.prospectStatus')}:</span>
                <Badge variant="outline">
                  {t(`callLogs.prospectStatuses.${prospectiveCustomer.status}`, prospectiveCustomer.status)}
                </Badge>
              </div>
            )}
            
            {isProspect && prospectiveCustomer.lastContactDate && (
              <div className="flex items-start mt-1">
                <Clock className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  {t('callLogs.lastContact')}: {formatDate(prospectiveCustomer.lastContactDate)}
                </span>
              </div>
            )}
            
            {isProspect && prospectiveCustomer.source && (
              <div className="flex items-start mt-1">
                <Info className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  {t('callLogs.source')}: {prospectiveCustomer.source}
                </span>
              </div>
            )}
          </TabsContent>
          
          {/* Orders Tab */}
          {!isProspect && (
            <TabsContent value="orders" className="h-[170px]">
              {isLoadingOrders ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : isOrdersError ? (
                <div className="text-center py-5 text-sm text-muted-foreground">
                  <p>{t('common.errorLoadingData')}</p>
                </div>
              ) : recentOrders && recentOrders.length > 0 ? (
                <ScrollArea className="h-[170px]">
                  <div className="space-y-2">
                    {recentOrders.map((order: any) => (
                      <div key={order.id} className="flex justify-between items-start border rounded-md p-2 text-sm">
                        <div>
                          <div className="font-medium">{order.orderNumber}</div>
                          <div className="text-xs text-muted-foreground flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDate(order.orderDate)}
                          </div>
                          <Badge variant="outline" className="mt-1">
                            {t(`orders.status.${order.status}`, order.status)}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {new Intl.NumberFormat(isGreek ? 'el-GR' : 'en-US', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(order.totalAmount || 0)}
                          </div>
                          <Link to={`/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" className="h-7">
                              <FileText className="h-3 w-3 mr-1" />
                              {t('common.view')}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-5 text-sm text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                  <p>{t('callLogs.noOrders')}</p>
                </div>
              )}
            </TabsContent>
          )}
          
          {/* Call History Tab */}
          <TabsContent value="calls" className="h-[170px]">
            {isLoadingCalls ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : isCallsError ? (
              <div className="text-center py-5 text-sm text-muted-foreground">
                <p>{t('common.errorLoadingData')}</p>
              </div>
            ) : recentCalls && recentCalls.length > 0 ? (
              <ScrollArea className="h-[170px]">
                <div className="space-y-2">
                  {recentCalls.map((call: any) => (
                    <div key={call.id} className="flex justify-between items-start border rounded-md p-2 text-sm">
                      <div>
                        <div className="font-medium">{call.subject || t('callLogs.noSubject')}</div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(call.callDate)}
                          {call.duration && ` · ${call.duration} ${t('callLogs.minutes')}`}
                        </div>
                        {call.outcome && (
                          <Badge variant="outline" className="mt-1">
                            {t(`callLogs.form.outcome.${call.outcome}`, call.outcome)}
                          </Badge>
                        )}
                      </div>
                      <Link to={`/call-logs/${call.id}`}>
                        <Button variant="ghost" size="sm" className="h-7">
                          <Phone className="h-3 w-3 mr-1" />
                          {t('common.view')}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-5 text-sm text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p>{t('callLogs.noCallHistory')}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2">
        {isProspect ? (
          <Link to={`/prospective-customers/${prospectiveCustomerId}`}>
            <Button variant="outline" size="sm" className="w-full">
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('callLogs.viewFullProspectProfile')}
            </Button>
          </Link>
        ) : (
          <Link to={`/customers/${customerId}`}>
            <Button variant="outline" size="sm" className="w-full">
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('callLogs.viewFullCustomerProfile')}
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
};

export default CustomerDataCard;