import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
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
import { SupplierForm } from './SupplierForm';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const SupplierList = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

  // Fetch all suppliers
  const { data: suppliers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/supplier-payments/suppliers'],
    retry: 1,
  });

  // Delete supplier mutation
  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/supplier-payments/suppliers/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: t('supplierPayments.supplier.deleted'),
        description: t('supplierPayments.supplier.deleteSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/suppliers'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('supplierPayments.supplier.deleteError'),
        variant: 'destructive',
      });
    },
  });

  // Filter suppliers based on search query
  const filteredSuppliers = suppliers.filter((supplier: any) => {
    const query = searchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(query)) ||
      (supplier.vatNumber && supplier.vatNumber.toLowerCase().includes(query))
    );
  });

  const handleAddClick = () => {
    setSelectedSupplier(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedSupplier) {
      deleteSupplierMutation.mutate(selectedSupplier.id);
    }
  };

  return (
    <div>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('supplierPayments.suppliers')}</CardTitle>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" /> {t('supplierPayments.addSupplier')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('supplierPayments.searchSuppliers')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-4">{t('common.loading')}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('supplierPayments.supplier.name')}</TableHead>
                    <TableHead>{t('supplierPayments.supplier.contactPerson')}</TableHead>
                    <TableHead>{t('supplierPayments.supplier.vatNumber')}</TableHead>
                    <TableHead>{t('supplierPayments.supplier.phone')}</TableHead>
                    <TableHead>{t('supplierPayments.supplier.email')}</TableHead>
                    <TableHead>{t('supplierPayments.supplier.paymentTerms')}</TableHead>
                    <TableHead>{t('app.status')}</TableHead>
                    <TableHead className="text-right">{t('app.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        {t('supplierPayments.noSuppliers')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier: any) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contactPerson || '-'}</TableCell>
                        <TableCell>{supplier.vatNumber || '-'}</TableCell>
                        <TableCell>{supplier.phone || '-'}</TableCell>
                        <TableCell>{supplier.email || '-'}</TableCell>
                        <TableCell>{supplier.paymentTerms || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={supplier.isActive ? 'default' : 'outline'}>
                            {supplier.isActive ? t('common.active') : t('common.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(supplier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(supplier)}
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

      {/* Supplier Form Dialog */}
      <SupplierForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        supplier={selectedSupplier}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('supplierPayments.supplier.confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('supplierPayments.supplier.deleteWarning', { name: selectedSupplier?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteSupplierMutation.isPending}
            >
              {deleteSupplierMutation.isPending ? t('common.processing') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};