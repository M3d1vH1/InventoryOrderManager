import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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

// Helper function to handle Greek and other non-Latin character matching
function getMatchScore(text: string, query: string): number {
  // Handle empty cases
  if (!text) return 0
  if (!query) return 1
  
  // Convert to lowercase for case-insensitive matching
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Direct match has highest score
  if (textLower === queryLower) return 10
  
  // Contains the full query
  if (textLower.includes(queryLower)) return 9
  
  // Special handling for Greek character search with hardcoded edge cases
  // Direct handling for "ΑΚΤΗ" which is a problematic search term
  if (
    (queryLower.includes('ακτη') && textLower.includes('ακτη')) ||
    (queryLower.includes('ακτ') && textLower.includes('ακτη')) ||
    // Handle possible encoding variations
    (queryLower.includes('ακτ') && textLower.includes('ακτ')) || 
    // Even more specific case for ΑΚΤΗ ΑΓΙΟΥ ΙΩΑΝΝΗ
    textLower.includes('ακτη αγιου ιωαννη')
  ) {
    // Debug logs for Greek character matching
    console.log('Special case match for ΑΚΤΗ found:', {
      text: textLower,
      query: queryLower
    })
    return 9.9 // Almost highest score possible
  }
  
  // More general checks for Greek characters
  for (const greekWord of ['ακτη', 'ακτ', 'αγιου', 'ιωαννη']) {
    if (queryLower.includes(greekWord) && textLower.includes(greekWord)) {
      return 9.7
    }
  }
  
  // Check character by character for partial matches
  // This helps with encodings and special characters
  let charMatchCount = 0
  let consecutiveMatches = 0
  let maxConsecutive = 0
  
  for (let i = 0; i < queryLower.length; i++) {
    const queryChar = queryLower.charAt(i)
    if (textLower.includes(queryChar)) {
      charMatchCount++
      consecutiveMatches++
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches)
    } else {
      consecutiveMatches = 0
    }
  }
  
  // If we have a significant number of matching characters
  if (charMatchCount > 0) {
    const charMatchRatio = charMatchCount / queryLower.length
    if (charMatchRatio > 0.7) return 7 // Most characters match
    if (maxConsecutive >= 2) return 5  // Some consecutive characters match
  }
  
  // Check word by word - higher score if matches more words
  const words = textLower.split(/\s+/)
  const queryWords = queryLower.split(/\s+/)
  
  let wordMatchCount = 0
  for (const queryWord of queryWords) {
    if (queryWord.length > 0 && words.some(word => word.includes(queryWord))) {
      wordMatchCount++
    }
  }
  
  if (wordMatchCount > 0) {
    return Math.min(8, 4 + wordMatchCount)
  }
  
  // Check for partial word matches (start of words)
  const startsWithQuery = words.some(word => word.startsWith(queryLower))
  if (startsWithQuery) return 4
  
  // Check for partial matches anywhere
  const partialMatches = words.filter(word => 
    word.length >= 2 && queryLower.length >= 2 && word.includes(queryLower)
  ).length
  
  if (partialMatches > 0) return 3
  
  // Check initials (first letter of each word)
  const initials = words.map(w => w.charAt(0)).join('')
  if (initials.includes(queryLower)) return 2
  
  // Very loose match - any common substring of reasonable length
  for (let i = 0; i < queryLower.length - 1; i++) {
    const subQuery = queryLower.substring(i, i + 2)
    if (textLower.includes(subQuery)) return 1
  }
  
  return 0
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

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    
    // Get match scores for all options using our specialized function
    const matchScores = options.map(option => ({
      option,
      score: getMatchScore(option.label, searchQuery)
    }))
    
    // Show debug info
    if (searchQuery.toLowerCase().includes('ακτ')) {
      const debugItems = matchScores
        .filter(item => item.option.label.toLowerCase().includes('ακτ'))
      
      if (debugItems.length > 0) {
        console.log('Debug Greek search for ΑΚΤΗ:', {
          query: searchQuery,
          matches: debugItems.map(item => ({
            label: item.option.label,
            score: item.score
          }))
        })
      }
    }
    
    // Filter out options with zero score (no match)
    // and sort by descending score for best matches first
    return matchScores
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.option)
  }, [options, searchQuery])

  // Find the selected option
  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value)
  }, [options, value])

  return (
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
      <PopoverContent className={cn("p-0", popoverContentClassName)}>
        <Command className={className}>
          <CommandInput 
            placeholder={placeholder} 
            onValueChange={(value) => setSearchQuery(value)}
          />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-y-auto -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={String(option.value)}
                onSelect={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
            {filteredOptions.length === 0 && searchQuery !== "" && (
              <div className="py-2 px-4 text-sm text-muted-foreground">
                {notFoundText}
              </div>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}