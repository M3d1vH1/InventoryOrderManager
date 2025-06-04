import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Robust Unicode normalization and diacritic removal for Greek and other languages
function normalizeText(text: string): string {
  if (!text) return '';
  
  // Use Unicode normalization (NFD) to decompose combined characters
  // This separates base characters from their diacritical marks
  let normalized = text.normalize('NFD');
  
  // Convert to lowercase using Greek locale for proper handling
  normalized = normalized.toLocaleLowerCase('el-GR');
  
  // Remove diacritical marks using Unicode combining character ranges
  // This covers accents, breathing marks, and other diacritics for all languages
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  
  // Additional Greek-specific cleanup for characters not handled by NFD
  const greekSpecialCases: Record<string, string> = {
    'ς': 'σ', // Final sigma to regular sigma
    'ϊ': 'ι', // Dialytika iota
    'ϋ': 'υ', // Dialytika upsilon
  };
  
  // Apply special case mappings
  for (const [special, base] of Object.entries(greekSpecialCases)) {
    normalized = normalized.replace(new RegExp(special, 'g'), base);
  }
  
  return normalized;
}

// Enhanced fuzzy matching with Unicode normalization for robust multilingual support
function fuzzyMatch(text: string, query: string): boolean {
  if (!text || !query) return false;
  
  // Normalize both text and query using Unicode NFD and diacritic removal
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  
  // Direct substring match (highest accuracy)
  if (normalizedText.includes(normalizedQuery)) return true;
  
  // Word-boundary matching for better relevance
  const textWords = normalizedText.split(/\s+/);
  const queryWords = normalizedQuery.split(/\s+/);
  
  // Check if all query words have matches in text words
  let matchedWords = 0;
  for (const queryWord of queryWords) {
    if (queryWord.length === 0) continue;
    
    const hasWordMatch = textWords.some((textWord: string) => {
      // Check for word start matching (higher relevance)
      if (textWord.startsWith(queryWord)) return true;
      // Check for substring matching within words
      if (textWord.includes(queryWord)) return true;
      return false;
    });
    
    if (hasWordMatch) matchedWords++;
  }
  
  // If most query words match, consider it a successful match
  if (queryWords.length > 0 && matchedWords >= Math.ceil(queryWords.length * 0.8)) {
    return true;
  }
  
  // Character-level fuzzy matching for partial matches
  let matchCount = 0;
  
  for (let i = 0; i < normalizedQuery.length; i++) {
    const char = normalizedQuery.charAt(i);
    if (normalizedText.includes(char)) {
      matchCount++;
    }
  }
  
  // Require at least 75% character match for fuzzy matching
  return matchCount >= normalizedQuery.length * 0.75;
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
  
  // Filter options using enhanced Greek character-aware fuzzy matching
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    
    // Create an array for matches with prioritization
    let matches: { option: ComboboxOption; priority: number }[] = [];
    
    // Normalize the search query for comparison using Unicode normalization
    const normalizedQuery = normalizeText(searchQuery);
    
    // Analyze each option for priority sorting
    options.forEach(option => {
      // Skip non-matching options using our enhanced fuzzy match
      if (!fuzzyMatch(option.label, searchQuery)) {
        return;
      }
      
      const normalizedLabel = normalizeText(option.label);
      
      // Calculate priority based on match quality:
      let priority = 0;
      
      // Highest priority: starts with the normalized query
      if (normalizedLabel.startsWith(normalizedQuery)) {
        priority = 100;
      }
      // High priority: contains the normalized query as a whole word
      else if (normalizedLabel.includes(` ${normalizedQuery}`) || 
               normalizedLabel.includes(`${normalizedQuery} `) ||
               normalizedLabel === normalizedQuery) {
        priority = 80;
      }
      // Medium priority: contains the normalized query anywhere
      else if (normalizedLabel.includes(normalizedQuery)) {
        priority = 60;
      }
      // Lower priority: fuzzy match (word-based or character-based)
      else {
        priority = 20;
      }
      
      matches.push({ option, priority });
    });
    
    // Sort by priority (highest first), then alphabetically by label
    matches.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.option.label.localeCompare(b.option.label, 'el'); // Greek locale for proper sorting
    });
    
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
        <span className="truncate mr-2 text-sm">
          {value && selectedOption
            ? selectedOption.label
            : placeholder}
        </span>
        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
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
                    onChange(option.value);
                    setOpen(false);
                    setSearchQuery(""); // Clear search when option is selected
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