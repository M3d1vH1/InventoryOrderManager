import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search, Receipt, FileText, DollarSign, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { InvoiceForm } from './InvoiceForm';
import { apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

export const InvoiceList = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Fetch all invoices
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['/api/supplier-payments/invoices'],
    retry: 1,
  });

  // Fetch all suppliers for dropdown
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['/api/supplier-payments/suppliers'],
    retry: 1,
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/supplier-payments/invoices/${id}`,
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: t('supplierPayments.invoice.deleted'),
        description: t('supplierPayments.invoice.deleteSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/summary'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('supplierPayments.invoice.deleteError'),
        variant: 'destructive',
      });
    },
  });

  // Filter invoices based on search query and status
  const filteredInvoices = invoices.filter((invoice: any) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      invoice.invoiceNumber?.toLowerCase().includes(query) ||
      getSupplierName(invoice.supplierId)?.toLowerCase().includes(query) ||
      invoice.notes?.toLowerCase().includes(query);
    
    if (filterStatus === 'all') {
      return matchesSearch;
    }
    
    return matchesSearch && invoice.status === filterStatus;
  });

  // Helper to get supplier name by ID
  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find((s: any) => s.id === supplierId);
    return supplier ? supplier.name : 'Unknown';
  };

  // Get badge variant based on invoice status
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'partially_paid':
        return 'warning';
      case 'overdue':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      default:
        return 'default';
    }
  };

  // Get icon based on invoice status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <DollarSign className="h-4 w-4" />;
      case 'partially_paid':
        return <Receipt className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      case 'cancelled':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleAddClick = () => {
    setSelectedInvoice(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedInvoice) {
      deleteInvoiceMutation.mutate(selectedInvoice.id);
    }
  };

  return (
    <div>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('supplierPayments.invoice.list')}</CardTitle>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" /> {t('supplierPayments.invoice.add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('supplierPayments.invoice.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('supplierPayments.invoice.filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('supplierPayments.invoice.allStatuses')}</SelectItem>
                  <SelectItem value="pending">{t('supplierPayments.invoice.statusPending')}</SelectItem>
                  <SelectItem value="paid">{t('supplierPayments.invoice.statusPaid')}</SelectItem>
                  <SelectItem value="partially_paid">{t('supplierPayments.invoice.statusPartiallyPaid')}</SelectItem>
                  <SelectItem value="overdue">{t('supplierPayments.invoice.statusOverdue')}</SelectItem>
                  <SelectItem value="cancelled">{t('supplierPayments.invoice.statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingInvoices || isLoadingSuppliers ? (
            <div className="text-center py-4">{t('common.loading')}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('supplierPayments.invoice.invoiceNumber')}</TableHead>
                    <TableHead>{t('supplierPayments.invoice.supplier')}</TableHead>
                    <TableHead>{t('supplierPayments.invoice.invoiceDate')}</TableHead>
                    <TableHead>{t('supplierPayments.invoice.dueDate')}</TableHead>
                    <TableHead>{t('supplierPayments.invoice.amount')}</TableHead>
                    <TableHead>{t('supplierPayments.invoice.paidAmount')}</TableHead>
                    <TableHead>{t('supplierPayments.invoice.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        {t('supplierPayments.invoice.noResults')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{getSupplierName(invoice.supplierId)}</TableCell>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                        <TableCell>{formatCurrency(invoice.paidAmount || 0)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusBadgeVariant(invoice.status)}
                            className="flex w-fit items-center gap-1"
                          >
                            {getStatusIcon(invoice.status)}
                            {t(`supplierPayments.invoice.status${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(invoice)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(invoice)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Form Dialog */}
      <InvoiceForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        invoice={selectedInvoice}
        suppliers={suppliers}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('supplierPayments.invoice.confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('supplierPayments.invoice.deleteWarning', { number: selectedInvoice?.invoiceNumber })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending ? t('common.processing') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};