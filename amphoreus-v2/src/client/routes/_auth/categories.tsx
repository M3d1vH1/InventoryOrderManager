import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";

export const Route = createFileRoute("/_auth/categories" as any)({
    component: CategoriesPage,
});

function CategoriesPage() {
    const { t } = useTranslation("products");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null);
    const [name, setName] = useState("");

    const utils = trpc.useUtils();
    const { data: categories, isLoading } = trpc.products.categories.list.useQuery();

    const createMutation = trpc.products.categories.create.useMutation({
        onSuccess: () => {
            utils.products.categories.list.invalidate();
            setIsDialogOpen(false);
            setName("");
        },
    });

    const updateMutation = trpc.products.categories.update.useMutation({
        onSuccess: () => {
            utils.products.categories.list.invalidate();
            setIsDialogOpen(false);
            setEditingCategory(null);
            setName("");
        },
    });

    const deleteMutation = trpc.products.categories.delete.useMutation({
        onSuccess: () => {
            utils.products.categories.list.invalidate();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            updateMutation.mutate({ id: editingCategory.id, name });
        } else {
            createMutation.mutate({ name });
        }
    };

    const handleEdit = (cat: { id: number; name: string }) => {
        setEditingCategory(cat);
        setName(cat.name);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: number) => {
        if (confirm("Are you sure you want to delete this category?")) {
            deleteMutation.mutate({ id });
        }
    };

    return (
        <PageShell
            title={t("categories", "Categories")}
            actions={
                <Button onClick={() => { setEditingCategory(null); setName(""); setIsDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> {t("addCategory", "Add Category")}
                </Button>
            }
        >
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("table.name", "Name")}</TableHead>
                            <TableHead className="text-right">{t("table.actions", "Actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={2}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : categories?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center py-10 text-muted-foreground">
                                    No categories found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            categories?.map((cat: any) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-medium">{cat.name}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? t("editCategory", "Edit Category") : t("addCategory", "Add Category")}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("form.name", "Name")}</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                {t("common.cancel", "Cancel")}
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {t("common.save", "Save")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
