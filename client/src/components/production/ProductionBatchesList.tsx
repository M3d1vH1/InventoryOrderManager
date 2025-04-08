import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Search, Plus, ClipboardList, ArrowUpDown, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ProductionBatchForm from './ProductionBatchForm';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export default function ProductionBatchesList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [batchFormOpen, setBatchFormOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch batches from API
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['/api/production/batches'],
  });

  const filteredBatches = searchTerm 
    ? batches.filter((batch: any) => 
        batch.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : batches;

  const sortedBatches = [...filteredBatches].sort((a, b) => {
    if (sortOrder === 'asc') {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    }
  });

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleAddBatch = () => {
    setSelectedBatch(null);
    setBatchFormOpen(true);
  };

  const handleEditBatch = (batch: any) => {
    setSelectedBatch(batch);
    setBatchFormOpen(true);
  };

  const handleViewDetails = (batch: any) => {
    setSelectedBatch(batch);
    setDetailsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'planned': 'bg-blue-100 text-blue-800 border-blue-300',
      'in_progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'quality_check': 'bg-purple-100 text-purple-800 border-purple-300',
      'approved': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'rejected': 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <Badge
        variant="outline"
        className={statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300'}
      >
        {t(`production.batchStatus.${status}`)}
      </Badge>
    );
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'PPP');
    } catch (error) {
      return '—';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('production.batchesList')}</CardTitle>
              <CardDescription>{t('production.batchesDescription')}</CardDescription>
            </div>
            <Button onClick={handleAddBatch}>
              <Plus className="mr-2 h-4 w-4" /> {t('production.addBatch')}
            </Button>
          </div>
          <div className="flex mt-4">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('production.searchBatches')}
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
                  <TableHead>{t('production.batchNumber')}</TableHead>
                  <TableHead>
                    <button 
                      className="flex items-center gap-1"
                      onClick={toggleSortOrder}
                    >
                      {t('production.startDate')}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>{t('production.endDate')}</TableHead>
                  <TableHead>{t('production.status')}</TableHead>
                  <TableHead>{t('production.quantity')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      {t('loading')}...
                    </TableCell>
                  </TableRow>
                ) : sortedBatches.length > 0 ? (
                  sortedBatches.map((batch: any) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                      <TableCell>{formatDate(batch.startDate)}</TableCell>
                      <TableCell>{formatDate(batch.endDate)}</TableCell>
                      <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      <TableCell>
                        {batch.quantity} {t(`production.units.${batch.unit}`)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleViewDetails(batch)}
                        >
                          <ClipboardList className="mr-2 h-4 w-4" />
                          {t('production.details')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBatch(batch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      {searchTerm ? t('production.noBatchesFound') : t('production.noBatchesYet')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Form Dialog */}
      <ProductionBatchForm 
        open={batchFormOpen} 
        onOpenChange={setBatchFormOpen} 
        batchToEdit={selectedBatch} 
      />

      {/* Batch Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedBatch?.batchNumber || ''} {t('production.details')}
            </DialogTitle>
            <DialogDescription>
              {t('production.batchDetailsDescription')}
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-1">{t('production.batchNumber')}</h4>
                <p>{selectedBatch.batchNumber}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">{t('production.status')}</h4>
                <p>{getStatusBadge(selectedBatch.status)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">{t('production.quantity')}</h4>
                <p>
                  {selectedBatch.quantity} {t(`production.units.${selectedBatch.unit}`)}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">{t('production.startDate')}</h4>
                <p>{formatDate(selectedBatch.startDate)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">{t('production.endDate')}</h4>
                <p>{formatDate(selectedBatch.endDate)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">{t('production.createdBy')}</h4>
                <p>{selectedBatch.createdByName || '—'}</p>
              </div>
              <div className="col-span-2">
                <h4 className="text-sm font-medium mb-1">{t('notes')}</h4>
                <p className="whitespace-pre-wrap">{selectedBatch.notes || '—'}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleEditBatch(selectedBatch)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
            <DialogClose asChild>
              <Button type="button">
                {t('close')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}