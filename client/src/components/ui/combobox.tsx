import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listboxRef = React.useRef<HTMLDivElement>(null)

  // Find the selected option
  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value)
  }, [options, value])
  
  // Filter options using our fuzzy matching algorithm
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    
    // Special case debugging for ΑΚΤΗ search
    if (searchQuery.toLowerCase().includes('ακτ')) {
      console.log('Searching for ΑΚΤΗ with query:', searchQuery);
      
      // Find all options containing "ΑΚΤΗ"
      const aktiOptions = options.filter(option => 
        option.label.toLowerCase().includes('ακτ')
      );
      
      if (aktiOptions.length > 0) {
        console.log('Found ΑΚΤΗ options:', aktiOptions);
      } else {
        console.log('No ΑΚΤΗ options found in available options');
      }
    }
    
    return options.filter(option => fuzzyMatch(option.label, searchQuery));
  }, [options, searchQuery]);

  // Handle scrolling in dropdown
  React.useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (listboxRef.current && listboxRef.current.contains(e.target as Node)) {
        e.preventDefault();
        listboxRef.current.scrollTop += e.deltaY;
      }
    };

    const listbox = listboxRef.current;
    if (listbox) {
      listbox.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (listbox) {
        listbox.removeEventListener('wheel', handleWheel);
      }
    };
  }, [open]);

  return (
    <div className={cn("relative w-full", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between",
          disabled && "opacity-50 cursor-not-allowed",
          triggerClassName
        )}
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            // Focus the input when opening
            setTimeout(() => inputRef.current?.focus(), 10);
          }
        }}
      >
        {value && selectedOption
          ? selectedOption.label
          : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery === "" ? emptyText : notFoundText}
            </div>
          ) : (
            <div 
              ref={listboxRef}
              className="max-h-[200px] overflow-auto py-1"
              style={{ scrollBehavior: 'smooth' }}
              tabIndex={-1}
            >
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}