import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Special case fuzzy matching for Greek and other non-Latin characters
function fuzzyMatch(text: string, query: string): boolean {
  if (!text || !query) return false;
  
  // Convert to lowercase
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact matches always return true
  if (textLower.includes(queryLower)) return true;
  
  // Special case for ΑΚΤΗ
  if (queryLower === "ακτη" || queryLower === "ακτ") {
    return textLower.includes("ακτη") || textLower.includes("ακτ");
  }
  
  // Split into words for word-by-word matching
  const textWords = textLower.split(/\s+/);
  const queryWords = queryLower.split(/\s+/);
  
  // Check if any query word is contained in any text word
  for (const queryWord of queryWords) {
    // Skip empty words
    if (queryWord.length === 0) continue;
    
    // Check if any text word contains this query word
    const wordMatch = textWords.some(textWord => textWord.includes(queryWord));
    if (wordMatch) return true;
  }
  
  // Character-by-character matching for partial matches
  let matchCount = 0;
  for (const char of queryLower) {
    if (textLower.includes(char)) {
      matchCount++;
    }
  }
  
  // If more than 70% of characters match, consider it a match
  return matchCount > queryLower.length * 0.7;
}

interface ComboboxOption {
  value: string | number
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  notFoundText?: string
  triggerClassName?: string
  popoverContentClassName?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  emptyText = "No options found.",
  notFoundText = "No option found.",
  className,
  disabled = false,
  triggerClassName,
  popoverContentClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  
  // Find the selected option
  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value)
  }, [options, value])

  // Custom command filter function that uses our fuzzy matching
  const commandFilter = React.useCallback((value: string, search: string) => {
    return fuzzyMatch(value, search) ? 1 : 0;
  }, []);

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              disabled && "opacity-50 cursor-not-allowed",
              triggerClassName
            )}
            disabled={disabled}
          >
            {value && selectedOption
              ? selectedOption.label
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("p-0", popoverContentClassName)} 
          align="start"
          side="bottom"
          sideOffset={5}
        >
          <Command filter={commandFilter}>
            <CommandInput placeholder={placeholder} className="h-9" />
            <CommandEmpty>
              {notFoundText}
            </CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}