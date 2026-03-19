import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Card, CardContent } from "../ui/card";

const productSchema = z.object({
    name: z.string().min(1, "Name is required").max(255),
    sku: z.string().min(1, "SKU is required").max(100),
    barcode: z.string().max(100).optional(),
    categoryId: z.number().int().optional(),
    description: z.string().optional(),
    currentStock: z.number().int().min(0),
    minStockLevel: z.number().int().min(0),
    imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
    initialData?: Partial<Omit<ProductFormValues, "description" | "barcode" | "categoryId" | "imageUrl">> & {
        id?: number;
        description?: string | null;
        barcode?: string | null;
        categoryId?: number | null;
        imageUrl?: string | null;
    };
    onSubmitSuccess: () => void;
}

export function ProductForm({ initialData, onSubmitSuccess }: ProductFormProps) {
    const isEditing = !!initialData?.id;
    const { data: categories, isLoading: loadingCategories } =
        trpc.products.categories.list.useQuery();

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: initialData?.name || "",
            sku: initialData?.sku || "",
            barcode: initialData?.barcode || "",
            categoryId: initialData?.categoryId || undefined,
            description: initialData?.description || "",
            currentStock: initialData?.currentStock || 0,
            minStockLevel: initialData?.minStockLevel || 0,
            imageUrl: initialData?.imageUrl || "",
        },
    });

    const createMutation = trpc.products.create.useMutation({
        onSuccess: onSubmitSuccess,
    });

    const updateMutation = trpc.products.update.useMutation({
        onSuccess: onSubmitSuccess,
    });

    const isPending = createMutation.isPending || updateMutation.isPending;

    function onSubmit(data: ProductFormValues) {
        // Convert empty string back to undefined for zod
        const payload = {
            ...data,
            imageUrl: data.imageUrl === "" ? undefined : data.imageUrl,
        };

        if (isEditing) {
            updateMutation.mutate({ id: initialData?.id!, ...payload });
        } else {
            createMutation.mutate(payload);
        }
    }

    const globalError = createMutation.error || updateMutation.error;

    return (
        <Card className="border-0 shadow-sm sm:border sm:shadow">
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {globalError && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {globalError.message}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Product Name *</Label>
                            <Input id="name" {...form.register("name")} />
                            {form.formState.errors.name && (
                                <p className="text-red-600 text-sm">
                                    {form.formState.errors.name.message}
                                </p>
                            )}
                        </div>

                        {/* SKU */}
                        <div className="space-y-2">
                            <Label htmlFor="sku">SKU *</Label>
                            <Input id="sku" {...form.register("sku")} />
                            {form.formState.errors.sku && (
                                <p className="text-red-600 text-sm">
                                    {form.formState.errors.sku.message}
                                </p>
                            )}
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                disabled={loadingCategories}
                                defaultValue={form.getValues("categoryId")?.toString()}
                                onValueChange={(val) => form.setValue("categoryId", Number(val))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories?.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Barcode */}
                        <div className="space-y-2">
                            <Label htmlFor="barcode">Barcode (Optional)</Label>
                            <Input id="barcode" {...form.register("barcode")} />
                        </div>

                        {/* Current Stock (Initial setup) */}
                        <div className="space-y-2">
                            <Label htmlFor="currentStock">Current Stock</Label>
                            <Input
                                id="currentStock"
                                type="number"
                                disabled={isEditing} // Prevent arbitrary changes of stock via general edit forms
                                {...form.register("currentStock", { valueAsNumber: true })}
                            />
                            {isEditing && (
                                <p className="text-xs text-gray-500">
                                    Use the stock adjustment UI to alter quantities.
                                </p>
                            )}
                            {form.formState.errors.currentStock && (
                                <p className="text-red-600 text-sm">
                                    {form.formState.errors.currentStock.message}
                                </p>
                            )}
                        </div>

                        {/* Min Stock Level */}
                        <div className="space-y-2">
                            <Label htmlFor="minStockLevel">Low Stock Warning Threshold</Label>
                            <Input
                                id="minStockLevel"
                                type="number"
                                {...form.register("minStockLevel", { valueAsNumber: true })}
                            />
                        </div>

                        {/* Image URL */}
                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                            <Input id="imageUrl" {...form.register("imageUrl")} />
                            {form.formState.errors.imageUrl && (
                                <p className="text-red-600 text-sm">
                                    {form.formState.errors.imageUrl.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? "Save Changes" : "Create Product"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
