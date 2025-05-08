import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { el } from 'date-fns/locale';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { PhoneCall, Phone, PhoneOutgoing, PhoneMissed, Calendar, ArrowUpDown, ChevronUp, ChevronDown, TagIcon, ClipboardCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface CallAnalyticsProps {
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}

// Custom colors for charts
const CHART_COLORS = {
  inbound: '#4f46e5',
  outbound: '#0ea5e9',
  missed: '#ef4444',
  // Outcomes
  order_placed: '#10b981',
  info_requested: '#6366f1',
  issue_resolved: '#8b5cf6', 
  requires_escalation: '#f59e0b',
  no_answer: '#ef4444',
  not_interested: '#94a3b8',
  other: '#64748b',
  // Status
  open: '#0ea5e9',
  closed: '#10b981',
  pending: '#f59e0b',
};

const CallAnalyticsDashboard: React.FC<CallAnalyticsProps> = ({ timeRange = 'week' }) => {
  const { t, i18n } = useTranslation();
  const isGreek = i18n.language === 'el';
  const [dateRange, setDateRange] = useState(timeRange);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch all call logs for analytics
  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['/api/call-logs/all'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/call-logs/all', {
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
  });

  // Function to determine date range based on selected timeRange
  const getDateRangeForFilter = (range: string): { start: Date, end: Date } => {
    const now = new Date();
    
    switch (range) {
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case 'quarter':
        // 3 months back
        return {
          start: subDays(now, 90),
          end: now,
        };
      case 'year':
        // 1 year back
        return {
          start: subDays(now, 365),
          end: now,
        };
      default:
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
    }
  };

  // Filter calls by selected date range
  const filteredCallLogs = useMemo(() => {
    if (!callLogs.length) return [];
    
    const { start, end } = getDateRangeForFilter(dateRange);
    
    return callLogs.filter((call: any) => {
      const callDate = parseISO(call.callDate);
      return isWithinInterval(callDate, { start, end });
    });
  }, [callLogs, dateRange]);

  // Calculate call statistics by type
  const callsByType = useMemo(() => {
    if (!filteredCallLogs.length) return [];
    
    const counts = {
      inbound: 0,
      outbound: 0,
      missed: 0,
      scheduled: 0,
    };
    
    filteredCallLogs.forEach((call: any) => {
      if (counts[call.callType] !== undefined) {
        counts[call.callType]++;
      }
    });
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredCallLogs]);

  // Calculate call statistics by outcome
  const callsByOutcome = useMemo(() => {
    if (!filteredCallLogs.length) return [];
    
    const counts: {[key: string]: number} = {
      none: 0,
      order_placed: 0,
      info_requested: 0,
      issue_resolved: 0,
      requires_escalation: 0,
      no_answer: 0,
      not_interested: 0,
      other: 0,
    };
    
    filteredCallLogs.forEach((call: any) => {
      const outcome = call.outcome || 'none';
      if (counts[outcome] !== undefined) {
        counts[outcome]++;
      } else {
        counts.other++;
      }
    });
    
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ 
        name, 
        value,
        label: t(`callLogs.form.outcome.${name}`, name)
      }));
  }, [filteredCallLogs, t]);

  // Calculate call statistics by status
  const callsByStatus = useMemo(() => {
    if (!filteredCallLogs.length) return [];
    
    const counts: {[key: string]: number} = {
      open: 0,
      closed: 0,
      pending: 0,
    };
    
    filteredCallLogs.forEach((call: any) => {
      const status = call.status || 'open';
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
    
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ 
        name, 
        value,
        label: t(`callLogs.form.status.${name}`, name)
      }));
  }, [filteredCallLogs, t]);

  // Calculate call tag distribution
  const callTagDistribution = useMemo(() => {
    if (!filteredCallLogs.length) return [];
    
    const tagCounts: {[key: string]: number} = {};
    
    filteredCallLogs.forEach((call: any) => {
      if (call.tags && call.tags.length) {
        call.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [filteredCallLogs]);

  // Calculate call volume by day for trend analysis
  const callVolumeByDay = useMemo(() => {
    if (!filteredCallLogs.length) return [];
    
    const volumeByDay: {[key: string]: {date: string, total: number, inbound: number, outbound: number, missed: number}} = {};
    
    // Initialize all days in the range
    const { start, end } = getDateRangeForFilter(dateRange);
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      volumeByDay[dateStr] = {
        date: format(currentDate, 'dd MMM', { locale: isGreek ? el : undefined }),
        total: 0,
        inbound: 0,
        outbound: 0,
        missed: 0,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Count calls by day
    filteredCallLogs.forEach((call: any) => {
      const dateStr = format(parseISO(call.callDate), 'yyyy-MM-dd');
      if (volumeByDay[dateStr]) {
        volumeByDay[dateStr].total++;
        if (call.callType && volumeByDay[dateStr][call.callType] !== undefined) {
          volumeByDay[dateStr][call.callType]++;
        }
      }
    });
    
    // Convert to array for chart
    return Object.values(volumeByDay);
  }, [filteredCallLogs, dateRange, isGreek]);

  // Calculate customer engagement metrics
  const customerEngagement = useMemo(() => {
    if (!filteredCallLogs.length) return { totalCustomers: 0, averageCallsPerCustomer: 0, topCustomers: [] };
    
    const customerCallCounts: {[key: string]: {id: number, name: string, count: number}} = {};
    let totalCustomers = 0;
    
    filteredCallLogs.forEach((call: any) => {
      // Handle both regular customers and prospective customers
      const customerId = call.customerId || (call.prospectiveCustomerId ? `p_${call.prospectiveCustomerId}` : null);
      const customerName = call.customerName || 'Unknown';
      
      if (customerId) {
        if (!customerCallCounts[customerId]) {
          customerCallCounts[customerId] = {
            id: call.customerId || call.prospectiveCustomerId,
            name: customerName,
            count: 0
          };
          totalCustomers++;
        }
        customerCallCounts[customerId].count++;
      }
    });
    
    const totalCalls = Object.values(customerCallCounts).reduce((sum, customer) => sum + customer.count, 0);
    const averageCallsPerCustomer = totalCustomers > 0 ? totalCalls / totalCustomers : 0;
    
    // Get top 5 customers by call volume
    const topCustomers = Object.values(customerCallCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalCustomers,
      averageCallsPerCustomer: parseFloat(averageCallsPerCustomer.toFixed(1)),
      topCustomers
    };
  }, [filteredCallLogs]);

  // Calculate call quality/effectiveness metrics
  const callEffectiveness = useMemo(() => {
    if (!filteredCallLogs.length) return { 
      conversionRate: 0, 
      followupRate: 0,
      resolutionRate: 0,
      averageDuration: 0
    };
    
    const totalCalls = filteredCallLogs.length;
    let ordersPlaced = 0;
    let callsNeedingFollowup = 0;
    let issuesResolved = 0;
    let totalDuration = 0;
    
    filteredCallLogs.forEach((call: any) => {
      if (call.outcome === 'order_placed') {
        ordersPlaced++;
      }
      
      if (call.outcome === 'issue_resolved') {
        issuesResolved++;
      }
      
      if (call.needsFollowup) {
        callsNeedingFollowup++;
      }
      
      if (call.duration) {
        totalDuration += call.duration;
      }
    });
    
    return {
      conversionRate: totalCalls > 0 ? parseFloat(((ordersPlaced / totalCalls) * 100).toFixed(1)) : 0,
      followupRate: totalCalls > 0 ? parseFloat(((callsNeedingFollowup / totalCalls) * 100).toFixed(1)) : 0,
      resolutionRate: totalCalls > 0 ? parseFloat(((issuesResolved / totalCalls) * 100).toFixed(1)) : 0,
      averageDuration: totalCalls > 0 ? parseFloat((totalDuration / totalCalls).toFixed(1)) : 0
    };
  }, [filteredCallLogs]);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-md px-4 py-2 shadow-sm">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-medium flex items-center">
            <PhoneCall className="mr-2 h-5 w-5" />
            {t('callLogs.analytics.title')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('callLogs.analytics.description')}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('callLogs.analytics.selectTimeRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t('callLogs.analytics.thisWeek')}</SelectItem>
              <SelectItem value="month">{t('callLogs.analytics.thisMonth')}</SelectItem>
              <SelectItem value="quarter">{t('callLogs.analytics.lastQuarter')}</SelectItem>
              <SelectItem value="year">{t('callLogs.analytics.lastYear')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Total Calls Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('callLogs.analytics.totalCalls')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{filteredCallLogs.length}</div>
              <div>
                {filteredCallLogs.length > 0 && callLogs.length > 0 && (
                  <Badge variant={filteredCallLogs.length > callLogs.length / 2 ? "default" : "outline"}>
                    {filteredCallLogs.length > callLogs.length / 2 ? (
                      <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    )}
                    {Math.round((filteredCallLogs.length / callLogs.length) * 100)}%
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('callLogs.analytics.ofAllCalls', { count: callLogs.length })}
            </div>
          </CardContent>
        </Card>
        
        {/* Call Conversion Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('callLogs.analytics.conversionRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callEffectiveness.conversionRate}%</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('callLogs.analytics.conversionDescription')}
            </div>
          </CardContent>
        </Card>
        
        {/* Average Call Duration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('callLogs.analytics.averageDuration')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callEffectiveness.averageDuration} {t('callLogs.minutes')}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('callLogs.analytics.durationDescription')}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="overview" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="overview">{t('callLogs.analytics.overview')}</TabsTrigger>
          <TabsTrigger value="trends">{t('callLogs.analytics.trends')}</TabsTrigger>
          <TabsTrigger value="customers">{t('callLogs.analytics.customers')}</TabsTrigger>
          <TabsTrigger value="tags">{t('callLogs.analytics.tags')}</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Calls by Type Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.callsByType')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.callsByTypeDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {callsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callsByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => 
                          `${t(`callLogs.form.callTypes.${name}`, name)}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {callsByType.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[entry.name] || `#${Math.floor(Math.random() * 16777215).toString(16)}`} 
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      {t('callLogs.analytics.noData')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Calls by Outcome Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.callsByOutcome')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.callsByOutcomeDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {callsByOutcome.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={callsByOutcome}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 85, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="label" 
                        width={80}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t('callLogs.analytics.callCount')}>
                        {callsByOutcome.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[entry.name] || `#${Math.floor(Math.random() * 16777215).toString(16)}`} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      {t('callLogs.analytics.noData')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Calls by Status Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.callsByStatus')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.callsByStatusDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {callsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callsByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={0}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value, percent }) => 
                          `${t(`callLogs.form.status.${name}`, name)}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {callsByStatus.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[entry.name] || `#${Math.floor(Math.random() * 16777215).toString(16)}`} 
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      {t('callLogs.analytics.noData')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Key Performance Indicators */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.keyMetrics')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.keyMetricsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('callLogs.analytics.conversionRate')}</span>
                    <div className="flex items-center">
                      <span className="font-medium">{callEffectiveness.conversionRate}%</span>
                      <ClipboardCheck className="h-4 w-4 ml-2 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('callLogs.analytics.followupRate')}</span>
                    <div className="flex items-center">
                      <span className="font-medium">{callEffectiveness.followupRate}%</span>
                      <Calendar className="h-4 w-4 ml-2 text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('callLogs.analytics.resolutionRate')}</span>
                    <div className="flex items-center">
                      <span className="font-medium">{callEffectiveness.resolutionRate}%</span>
                      <CheckCircle className="h-4 w-4 ml-2 text-purple-500" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('callLogs.analytics.averageDuration')}</span>
                    <div className="flex items-center">
                      <span className="font-medium">{callEffectiveness.averageDuration} {t('callLogs.minutes')}</span>
                      <Clock className="h-4 w-4 ml-2 text-orange-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-md">
                {t('callLogs.analytics.callVolumeTrend')}
              </CardTitle>
              <CardDescription>
                {t('callLogs.analytics.callVolumeTrendDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {callVolumeByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={callVolumeByDay}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name={t('callLogs.analytics.totalCalls')}
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="inbound"
                      name={t('callLogs.form.callTypes.inbound')}
                      stroke="#4f46e5"
                    />
                    <Line
                      type="monotone"
                      dataKey="outbound"
                      name={t('callLogs.form.callTypes.outbound')}
                      stroke="#0ea5e9"
                    />
                    <Line
                      type="monotone"
                      dataKey="missed"
                      name={t('callLogs.form.callTypes.missed')}
                      stroke="#ef4444"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">
                    {t('callLogs.analytics.noData')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Outcome Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.callOutcomeMetrics')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.callOutcomeMetricsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Conversion Rate Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{t('callLogs.analytics.conversionRate')}</span>
                      <span className="text-sm font-medium">{callEffectiveness.conversionRate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(callEffectiveness.conversionRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('callLogs.analytics.conversionTarget', { target: '10%' })}
                    </p>
                  </div>
                  
                  {/* Resolution Rate Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{t('callLogs.analytics.resolutionRate')}</span>
                      <span className="text-sm font-medium">{callEffectiveness.resolutionRate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.min(callEffectiveness.resolutionRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('callLogs.analytics.resolutionTarget', { target: '80%' })}
                    </p>
                  </div>
                  
                  {/* Followup Rate Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{t('callLogs.analytics.followupRate')}</span>
                      <span className="text-sm font-medium">{callEffectiveness.followupRate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(callEffectiveness.followupRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('callLogs.analytics.followupTarget', { target: '30%' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Call Volume Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.callTypeComparison')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.callTypeComparisonDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[240px]">
                {callsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={callsByType}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tickFormatter={(value) => t(`callLogs.form.callTypes.${value}`, value)} />
                      <YAxis allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t('callLogs.analytics.callCount')}>
                        {callsByType.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[entry.name] || `#${Math.floor(Math.random() * 16777215).toString(16)}`} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      {t('callLogs.analytics.noData')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Engagement Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.customerEngagement')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.customerEngagementDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('callLogs.analytics.totalCustomers')}</span>
                    <span className="font-medium">{customerEngagement.totalCustomers}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('callLogs.analytics.averageCallsPerCustomer')}</span>
                    <span className="font-medium">{customerEngagement.averageCallsPerCustomer}</span>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('callLogs.analytics.topCustomers')}</h4>
                    {customerEngagement.topCustomers.length > 0 ? (
                      <div className="space-y-2">
                        {customerEngagement.topCustomers.map((customer, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm truncate max-w-[180px]">{customer.name}</span>
                            <Badge variant="outline">{customer.count} {t('callLogs.calls')}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('callLogs.analytics.noCustomerData')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Customer Call Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md">
                  {t('callLogs.analytics.customerCallDistribution')}
                </CardTitle>
                <CardDescription>
                  {t('callLogs.analytics.customerCallDistributionDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {customerEngagement.topCustomers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={customerEngagement.topCustomers}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        width={75}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name={t('callLogs.analytics.callCount')} fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">
                      {t('callLogs.analytics.noData')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-md">
                {t('callLogs.analytics.popularTags')}
              </CardTitle>
              <CardDescription>
                {t('callLogs.analytics.popularTagsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {callTagDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={callTagDistribution}
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      width={75}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="value" 
                      name={t('callLogs.analytics.occurrences')} 
                      fill="#8884d8" 
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center">
                  <TagIcon className="h-10 w-10 mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {t('callLogs.analytics.noTagData')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CallAnalyticsDashboard;