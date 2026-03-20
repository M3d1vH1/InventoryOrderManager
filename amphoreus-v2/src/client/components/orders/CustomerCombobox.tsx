import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../ui/popover";
import { Input } from "../ui/input";

interface Props {
    value: number | null;
    onChange: (id: number, name: string) => void;
}

export function CustomerCombobox({ value, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const { data, isLoading } = trpc.customers.list.useQuery({
        search: search || undefined,
        perPage: 30,
    });

    const currentCustomer = data?.items.find((c) => c.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-72 justify-between font-normal"
                >
                    {currentCustomer ? currentCustomer.name : "Select customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
                <div className="p-2 border-b">
                    <Input
                        placeholder="Search customers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8"
                    />
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {isLoading && (
                        <p className="text-sm text-muted-foreground p-3">Loading...</p>
                    )}
                    {!isLoading && data?.items.length === 0 && (
                        <p className="text-sm text-muted-foreground p-3">No customers found.</p>
                    )}
                    {data?.items.map((c) => (
                        <button
                            key={c.id}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent text-sm"
                            onClick={() => {
                                onChange(c.id, c.name);
                                setOpen(false);
                                setSearch("");
                            }}
                        >
                            <Check
                                className={`h-4 w-4 ${value === c.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <span className="font-medium">{c.name}</span>
                            {c.city && <span className="text-muted-foreground ml-auto">{c.city}</span>}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
