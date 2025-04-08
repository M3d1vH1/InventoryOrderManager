import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import RawMaterialForm from './RawMaterialForm';

// Mock data for demonstration
const mockMaterials = [
  {
    id: 1,
    name: 'Extra Virgin Olive Oil',
    sku: 'RAW-EVOO-01',
    quantity: 1500,
    unit: 'liter',
    cost: 8.5,
    supplier: 'Local Olive Farm',
    supplierSku: 'EVOO-PREMIUM',
    minimumStock: 500,
    location: 'Warehouse A - Tank 1',
    notes: 'Premium quality, early harvest',
    type: 'olive'
  },
  {
    id: 2,
    name: 'Clear Glass Bottle 750ml',
    sku: 'PKG-BOT-750',
    quantity: 10000,
    unit: 'piece',
    cost: 0.65,
    supplier: 'Glass Manufacturing Inc.',
    supplierSku: 'BOT-750-CL',
    minimumStock: 2000,
    location: 'Warehouse B - Shelf 3',
    notes: 'Clear glass, high quality finish',
    type: 'bottle'
  },
  {
    id: 3,
    name: 'Premium Cork Cap',
    sku: 'PKG-CAP-PRE',
    quantity: 12000,
    unit: 'piece',
    cost: 0.25,
    supplier: 'Packaging Solutions Ltd.',
    supplierSku: 'CORK-CAP-01',
    minimumStock: 3000,
    location: 'Warehouse B - Shelf 5',
    notes: 'Natural cork with wooden top',
    type: 'cap'
  },
  {
    id: 4,
    name: 'Premium Label Design A',
    sku: 'PKG-LBL-A',
    quantity: 8000,
    unit: 'piece',
    cost: 0.15,
    supplier: 'Print Perfect',
    supplierSku: 'LBL-PREM-A',
    minimumStock: 2000,
    location: 'Warehouse B - Cabinet 2',
    notes: 'Waterproof, high-quality print',
    type: 'label'
  },
  {
    id: 5,
    name: 'Gift Box for 3 Bottles',
    sku: 'PKG-BOX-3',
    quantity: 500,
    unit: 'piece',
    cost: 1.75,
    supplier: 'Box and Packaging Co.',
    supplierSku: 'GB-OIL-3',
    minimumStock: 100,
    location: 'Warehouse C - Section 2',
    notes: 'Premium cardboard with magnetic closure',
    type: 'box'
  }
];

export default function RawMaterialsList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState(mockMaterials);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  
  const filteredMaterials = searchTerm 
    ? materials.filter(material => 
        material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
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