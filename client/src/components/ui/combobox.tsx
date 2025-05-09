import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
  
  // Find the selected option
  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value)
  }, [options, value])
  
  // Filter options using our fuzzy matching algorithm with improved prioritization
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    
    // Create an array for matches with prioritization
    let matches: { option: ComboboxOption; priority: number }[] = [];
    
    // Convert search query to lowercase for case-insensitive matching
    const lowerQuery = searchQuery.toLowerCase();
    
    // Special case debugging for ΑΚΤΗ search
    if (lowerQuery.includes('ακτ')) {
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
    
    // Analyze each option for priority sorting
    options.forEach(option => {
      const lowerLabel = option.label.toLowerCase();
      
      // Skip non-matching options
      if (!fuzzyMatch(option.label, searchQuery)) {
        return;
      }
      
      // Calculate priority:
      let priority = 0;
      
      // Highest priority: starts with the exact query
      if (lowerLabel.startsWith(lowerQuery)) {
        priority = 100;
      }
      // High priority: contains the exact query as a word
      else if (lowerLabel.includes(` ${lowerQuery}`) || lowerLabel.includes(`${lowerQuery} `)) {
        priority = 80;
      }
      // Medium priority: contains the exact query somewhere
      else if (lowerLabel.includes(lowerQuery)) {
        priority = 60;
      }
      // Special case for ΑΚΤΗ
      else if (lowerQuery.includes('ακτ') && lowerLabel.includes('ακτ')) {
        priority = 90; // Very high priority for ΑΚΤΗ matches
      }
      // Low priority: fuzzy match
      else {
        priority = 20;
      }
      
      matches.push({ option, priority });
    });
    
    // Sort by priority (highest first)
    matches.sort((a, b) => b.priority - a.priority);
    
    // Return just the sorted options
    return matches.map(match => match.option);
  }, [options, searchQuery]);

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
        onClick={() => setOpen(!open)}
      >
        {value && selectedOption
          ? selectedOption.label
          : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg">
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {searchQuery === "" ? emptyText : notFoundText}
            </div>
          ) : (
            <div 
              className="max-h-[200px] overflow-auto py-1"
              style={{ scrollBehavior: 'smooth' }}
            >
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    value === option.value ? "bg-gray-100 dark:bg-gray-800" : ""
                  )}
                  onClick={() => {
                    console.log('Option clicked:', option.value);
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}