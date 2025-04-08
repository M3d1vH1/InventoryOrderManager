import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2
} from 'lucide-react';
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

import CallOutcomeForm from './CallOutcomeForm';

interface CallOutcomeListProps {
  callId: number;
}

type CallOutcome = {
  id: number;
  callId: number;
  outcome: string;
  status: string;
  dueDate: string | null;
  assignedToId: number | null;
  completedById: number | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const CallOutcomeList: React.FC<CallOutcomeListProps> = ({ callId }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [outcomeFormOpen, setOutcomeFormOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [outcomeToDelete, setOutcomeToDelete] = useState<number | null>(null);
  const [outcomeToComplete, setOutcomeToComplete] = useState<number | null>(null);

  // Fetch call outcomes
  const { data: outcomes, isLoading, isError, refetch } = useQuery({
    queryKey: [`/api/call-logs/${callId}/outcomes`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/call-logs/${callId}/outcomes`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch call outcomes');
        }
        
        return response.json();
      } catch (error) {
        console.error('Error fetching call outcomes:', error);
        throw error;
      }
    },
    enabled: !!callId,
  });

  // Handle adding a new outcome
  const handleAddOutcome = () => {
    setSelectedOutcome(null);
    setFormMode('create');
    setOutcomeFormOpen(true);
  };

  // Handle editing an outcome
  const handleEditOutcome = (outcome: CallOutcome) => {
    setSelectedOutcome(outcome);
    setFormMode('edit');
    setOutcomeFormOpen(true);
  };

  // Handle deleting an outcome
  const handleDeleteClick = (outcomeId: number) => {
    setOutcomeToDelete(outcomeId);
    setDeleteDialogOpen(true);
  };

  // Handle confirming outcome deletion
  const confirmDelete = async () => {
    if (!outcomeToDelete) return;

    try {
      const response = await fetch(`/api/call-logs/outcomes/${outcomeToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete outcome');
      }

      toast({
        title: t('callLogs.outcomes.deleteSuccess'),
        description: t('callLogs.outcomes.deleteSuccessDescription'),
        variant: 'default',
      });

      // Refetch data
      queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}/outcomes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
    } catch (error) {
      console.error('Error deleting outcome:', error);
      toast({
        title: t('common.error'),
        description: t('callLogs.outcomes.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setOutcomeToDelete(null);
    }
  };

  // Handle marking an outcome as complete
  const handleCompleteClick = (outcomeId: number) => {
    setOutcomeToComplete(outcomeId);
    setCompleteDialogOpen(true);
  };

  // Handle confirming outcome completion
  const confirmComplete = async () => {
    if (!outcomeToComplete) return;

    try {
      const response = await fetch(`/api/call-logs/outcomes/${outcomeToComplete}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ notes: 'Completed from call log view' }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete outcome');
      }

      toast({
        title: t('callLogs.outcomes.completeSuccess'),
        description: t('callLogs.outcomes.completeSuccessDescription'),
        variant: 'default',
      });

      // Refetch data
      queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}/outcomes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
    } catch (error) {
      console.error('Error completing outcome:', error);
      toast({
        title: t('common.error'),
        description: t('callLogs.outcomes.completeError'),
        variant: 'destructive',
      });
    } finally {
      setCompleteDialogOpen(false);
      setOutcomeToComplete(null);
    }
  };

  // Get the appropriate status badge for an outcome
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertCircle className="mr-1 h-3 w-3" />
            {t('callLogs.outcomes.statuses.pending')}
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <RefreshCw className="mr-1 h-3 w-3" />
            {t('callLogs.outcomes.statuses.inProgress')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            {t('callLogs.outcomes.statuses.completed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('callLogs.outcomes.title')}</CardTitle>
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-[100px] w-full" />
            <Skeleton className="h-[100px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">{t('callLogs.outcomes.title')}</CardTitle>
          <CardDescription>{t('callLogs.outcomes.loadError')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>{t('callLogs.outcomes.title')}</CardTitle>
            <CardDescription>
              {outcomes?.length
                ? t('callLogs.outcomes.count', { count: outcomes.length })
                : t('callLogs.outcomes.empty')}
            </CardDescription>
          </div>
          <Button onClick={handleAddOutcome} size="sm" className="h-8">
            <Plus className="mr-1 h-4 w-4" />
            {t('callLogs.outcomes.addNew')}
          </Button>
        </CardHeader>
        <CardContent>
          {!outcomes?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('callLogs.outcomes.noOutcomes')}</p>
              <Button onClick={handleAddOutcome} variant="outline" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                {t('callLogs.outcomes.addNew')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {outcomes.map((outcome: CallOutcome) => (
                <div 
                  key={outcome.id} 
                  className={`p-4 rounded-lg border ${
                    outcome.status === 'completed' 
                      ? 'bg-green-50 border-green-100' 
                      : outcome.dueDate && new Date(outcome.dueDate) < new Date() 
                        ? 'bg-red-50 border-red-100' 
                        : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        {getStatusBadge(outcome.status)}
                        {outcome.dueDate && (
                          <div className="flex items-center ml-2 text-sm text-slate-600">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>
                              {format(new Date(outcome.dueDate), 'dd MMM yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-md font-medium mb-1">{outcome.outcome}</p>
                      {outcome.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {outcome.notes}
                        </p>
                      )}
                      <div className="text-xs text-slate-500 mt-2">
                        {t('common.created')}: {format(new Date(outcome.createdAt), 'dd MMM yyyy HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {outcome.status !== 'completed' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => handleCompleteClick(outcome.id)}
                          title={t('callLogs.outcomes.markComplete')}
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => handleEditOutcome(outcome)}
                        title={t('common.edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => handleDeleteClick(outcome.id)}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  
                  {outcome.completedAt && (
                    <div className="text-xs text-green-600 mt-2 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('callLogs.outcomes.completedAt')}: {format(new Date(outcome.completedAt), 'dd MMM yyyy HH:mm')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Outcome Form Dialog */}
      <CallOutcomeForm
        open={outcomeFormOpen}
        onOpenChange={setOutcomeFormOpen}
        callId={callId}
        initialData={selectedOutcome}
        mode={formMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('callLogs.outcomes.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('callLogs.outcomes.confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('callLogs.outcomes.confirmComplete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('callLogs.outcomes.confirmCompleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={confirmComplete}
            >
              {t('callLogs.outcomes.markComplete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CallOutcomeList;