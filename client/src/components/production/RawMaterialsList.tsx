import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import RawMaterialForm from './RawMaterialForm';

interface RawMaterial {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  cost: number;
  supplier?: string;
  supplierSku?: string;
  minimumStock: number;
  location?: string;
  notes?: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export default function RawMaterialsList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);

  // Fetch raw materials
  const { data: materialsData, isLoading, error } = useQuery({
    queryKey: ['/api/production/raw-materials', { q: searchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      
      const response = await fetch(`/api/production/raw-materials?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch raw materials');
      }
      const result = await response.json();
      return result.success ? result.data : [];
    },
  });

  // Create material mutation
  const createMaterialMutation = useMutation({
    mutationFn: (materialData: any) => 
      apiRequest('/api/production/raw-materials', {
        method: 'POST',
        body: JSON.stringify(materialData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/production/raw-materials'] });
      toast({
        title: t('success'),
        description: t('production.materialCreated'),
      });
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('production.createMaterialError'),
      });
    },
  });

  // Update material mutation
  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, ...materialData }: any) => 
      apiRequest(`/api/production/raw-materials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(materialData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/production/raw-materials'] });
      toast({
        title: t('success'),
        description: t('production.materialUpdated'),
      });
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('production.updateMaterialError'),
      });
    },
  });

  // Delete material mutation
  const deleteMaterialMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/production/raw-materials/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/production/raw-materials'] });
      toast({
        title: t('success'),
        description: t('production.materialDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('production.deleteMaterialError'),
      });
    },
  });

  const materials = materialsData || [];

  const handleCreateMaterial = (materialData: any) => {
    createMaterialMutation.mutate(materialData);
  };

  const handleUpdateMaterial = (materialData: any) => {
    if (editingMaterial) {
      updateMaterialMutation.mutate({ ...materialData, id: editingMaterial.id });
    }
  };

  const handleDeleteMaterial = (id: number) => {
    if (confirm(t('confirmDelete'))) {
      deleteMaterialMutation.mutate(id);
    }
  };

  const handleOpenDialog = (material?: RawMaterial) => {
    setEditingMaterial(material || null);
    setDialogOpen(true);
  };

  // Search is handled by the API now, so we don't need client-side filtering
  const filteredMaterials = materials;
    : materials;

  const handleAddNew = () => {
    setEditingMaterial(null);
    setDialogOpen(true);
  };

  const handleEdit = (material: any) => {
    setEditingMaterial(material);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setMaterials(materials.filter(material => material.id !== id));
  };

  const handleSave = (materialData: any) => {
    if (editingMaterial) {
      // Update existing material
      setMaterials(materials.map(material => 
        material.id === editingMaterial.id ? { ...material, ...materialData } : material
      ));
    } else {
      // Add new material
      const newId = Math.max(...materials.map(m => m.id), 0) + 1;
      setMaterials([...materials, { id: newId, ...materialData }]);
    }
    setDialogOpen(false);
  };

  const getStockStatus = (material: any) => {
    if (material.quantity <= 0) {
      return { label: t('production.outOfStock'), color: 'bg-red-100 text-red-800 border-red-300' };
    }
    if (material.quantity <= material.minimumStock) {
      return { label: t('production.lowStock'), color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    }
    return { label: t('production.inStock'), color: 'bg-green-100 text-green-800 border-green-300' };
  };

  const getMaterialTypeLabel = (type: string) => {
    return t(`production.materialTypes.${type}`) || type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('production.rawMaterialsList')}</CardTitle>
            <CardDescription>{t('production.rawMaterialsDescription')}</CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" /> {t('production.addMaterial')}
          </Button>
        </div>
        <div className="flex mt-4">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('production.searchMaterials')}
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
                <TableHead className="w-[15%]">{t('products.sku')}</TableHead>
                <TableHead className="w-[25%]">{t('production.materialName')}</TableHead>
                <TableHead className="w-[10%]">{t('production.type')}</TableHead>
                <TableHead className="w-[15%]">{t('production.quantity')}</TableHead>
                <TableHead className="w-[15%]">{t('production.status')}</TableHead>
                <TableHead className="text-right w-[20%]">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length > 0 ? (
                filteredMaterials.map((material) => {
                  const stockStatus = getStockStatus(material);
                  
                  return (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.sku}</TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>{getMaterialTypeLabel(material.type)}</TableCell>
                      <TableCell>
                        {material.quantity} {t(`production.units.${material.unit}`)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={stockStatus.color}
                        >
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(material)}
                          className="mr-1"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(material.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    {searchTerm ? t('production.noMaterialsFound') : t('production.noMaterialsYet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingMaterial ? t('production.editMaterial') : t('production.addMaterial')}
              </DialogTitle>
            </DialogHeader>
            
            <RawMaterialForm 
              material={editingMaterial}
              onSave={handleSave}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}