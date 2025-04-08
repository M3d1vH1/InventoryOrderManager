import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form validation schema
const materialSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  sku: z.string().min(2, { message: "SKU is required" }),
  quantity: z.coerce.number().positive({ message: "Quantity must be positive" }),
  unit: z.string().min(1, { message: "Unit is required" }),
  cost: z.coerce.number().nonnegative({ message: "Cost must be zero or positive" }),
  supplier: z.string().optional(),
  supplierSku: z.string().optional(),
  minimumStock: z.coerce.number().nonnegative({ message: "Minimum stock must be zero or positive" }),
  location: z.string().optional(),
  notes: z.string().optional(),
  type: z.string().min(1, { message: "Material type is required" }),
});

type MaterialFormValues = z.infer<typeof materialSchema>;

type RawMaterialFormProps = {
  material?: any;
  onSave: (material: MaterialFormValues) => void;
  onCancel: () => void;
};

export default function RawMaterialForm({ material, onSave, onCancel }: RawMaterialFormProps) {
  const { t } = useTranslation();
  
  // Initialize form with default values or existing material data
  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: material?.name || "",
      sku: material?.sku || "",
      quantity: material?.quantity || 0,
      unit: material?.unit || "kg",
      cost: material?.cost || 0,
      supplier: material?.supplier || "",
      supplierSku: material?.supplierSku || "",
      minimumStock: material?.minimumStock || 0,
      location: material?.location || "",
      notes: material?.notes || "",
      type: material?.type || "olive",
    },
  });

  // Handle form submission
  const onSubmit = (values: MaterialFormValues) => {
    onSave(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.materialName')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('production.materialNamePlaceholder') || "e.g. Extra Virgin Olive Oil"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('products.sku')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('production.skuPlaceholder') || "e.g. RAW-EVOO-001"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.quantity')}</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.unit')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('production.selectUnit') || "Select unit"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="kg">{t('production.units.kg')}</SelectItem>
                    <SelectItem value="liter">{t('production.units.liter')}</SelectItem>
                    <SelectItem value="piece">{t('production.units.piece')}</SelectItem>
                    <SelectItem value="box">{t('production.units.box')}</SelectItem>
                    <SelectItem value="bottle">{t('production.units.bottle')}</SelectItem>
                    <SelectItem value="label">{t('production.units.label')}</SelectItem>
                    <SelectItem value="cap">{t('production.units.cap')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.costPerUnit')}</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.supplier')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('production.supplierPlaceholder') || "Supplier name"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="supplierSku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.supplierSku')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('production.supplierSkuPlaceholder') || "Supplier's SKU"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="minimumStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.minimumStock')}</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.storageLocation')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('production.locationPlaceholder') || "e.g. Warehouse A, Shelf 3"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('production.materialType')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('production.selectType') || "Select type"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="olive">{t('production.materialTypes.olive')}</SelectItem>
                    <SelectItem value="bottle">{t('production.materialTypes.bottle')}</SelectItem>
                    <SelectItem value="cap">{t('production.materialTypes.cap')}</SelectItem>
                    <SelectItem value="label">{t('production.materialTypes.label')}</SelectItem>
                    <SelectItem value="box">{t('production.materialTypes.box')}</SelectItem>
                    <SelectItem value="filter">{t('production.materialTypes.filter')}</SelectItem>
                    <SelectItem value="other">{t('production.materialTypes.other')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notes')}</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t('production.materialNotesPlaceholder') || "Additional information about this material..."} 
                  className="resize-none h-20"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit">
            {material ? t('save') : t('production.addMaterial')}
          </Button>
        </div>
      </form>
    </Form>
  );
}