import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
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
import { Search, Plus, ClipboardList, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Mock data for demonstration
const mockBatches = [
  {
    id: 1,
    batchNumber: 'B-2025-001',
    startDate: new Date('2025-04-01T09:00:00'),
    endDate: new Date('2025-04-03T15:30:00'),
    status: 'completed',
    quantity: 2500,
    unit: 'liter',
    notes: 'Early harvest, premium quality',
    createdById: 1,
    createdByName: 'Admin'
  },
  {
    id: 2,
    batchNumber: 'B-2025-002',
    startDate: new Date('2025-04-10T08:30:00'),
    endDate: null,
    status: 'in_progress',
    quantity: 3000,
    unit: 'liter',
    notes: 'Standard harvest',
    createdById: 1,
    createdByName: 'Admin'
  },
  {
    id: 3,
    batchNumber: 'B-2025-003',
    startDate: new Date('2025-05-01T10:00:00'),
    endDate: null,
    status: 'planned',
    quantity: 5000,
    unit: 'liter',
    notes: 'Late harvest, aromatic',
    createdById: 2,
    createdByName: 'Maria'
  }
];

export default function ProductionBatchesList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [batches, setBatches] = useState(mockBatches);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredBatches = searchTerm 
    ? batches.filter(batch => 
        batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('production.batchesList')}</CardTitle>
            <CardDescription>{t('production.batchesDescription')}</CardDescription>
          </div>
          <Button>
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
              {sortedBatches.length > 0 ? (
                sortedBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>{format(new Date(batch.startDate), 'PPP')}</TableCell>
                    <TableCell>
                      {batch.endDate 
                        ? format(new Date(batch.endDate), 'PPP') 
                        : '—'
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell>
                      {batch.quantity} {t(`production.units.${batch.unit}`)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {t('production.details')}
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
  );
}