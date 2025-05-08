import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

interface CallTagSelectorProps {
  callId: number;
  selectedTags?: string[];
  onChange?: (tags: string[]) => void;
  readOnly?: boolean;
  size?: 'sm' | 'default';
}

const CallTagSelector: React.FC<CallTagSelectorProps> = ({
  callId,
  selectedTags = [],
  onChange,
  readOnly = false,
  size = 'default'
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selected, setSelected] = useState<string[]>(selectedTags || []);
  const isSmall = size === 'sm';

  // Fetch available tags
  const { data: availableTags = [] } = useQuery({
    queryKey: ['/api/tags'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/tags', {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch tags');
        }
        const data = await response.json();
        return data.map((tag: any) => tag.name);
      } catch (error) {
        console.error('Error fetching tags:', error);
        return [];
      }
    }
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name: tagName }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create tag');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.errorCreatingTag'),
        variant: 'destructive',
      });
    },
  });

  // Update call tags mutation
  const updateCallTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const response = await fetch(`/api/call-logs/${callId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tags }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update call tags');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      toast({
        title: t('callLogs.tagsUpdated'),
        description: t('callLogs.tagsUpdatedDescription'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.errorUpdatingTags'),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (selectedTags) {
      setSelected(selectedTags);
    }
  }, [selectedTags]);

  // Handle selecting a tag
  const handleSelect = (tag: string) => {
    if (readOnly) return;
    
    const isSelected = selected.includes(tag);
    let updatedTags: string[];
    
    if (isSelected) {
      updatedTags = selected.filter(t => t !== tag);
    } else {
      updatedTags = [...selected, tag];
    }
    
    setSelected(updatedTags);
    
    if (onChange) {
      onChange(updatedTags);
    } else {
      updateCallTagsMutation.mutate(updatedTags);
    }
  };

  // Handle removing a tag
  const handleRemove = (tag: string) => {
    if (readOnly) return;
    
    const updatedTags = selected.filter(t => t !== tag);
    setSelected(updatedTags);
    
    if (onChange) {
      onChange(updatedTags);
    } else {
      updateCallTagsMutation.mutate(updatedTags);
    }
  };

  // Handle creating a new tag
  const handleCreateTag = () => {
    if (!inputValue.trim()) return;
    
    createTagMutation.mutate(inputValue);
    
    // Optimistically add to selected
    const updatedTags = [...selected, inputValue];
    setSelected(updatedTags);
    
    if (onChange) {
      onChange(updatedTags);
    } else {
      updateCallTagsMutation.mutate(updatedTags);
    }
    
    setInputValue('');
  };

  // Filter out already selected tags from suggestions
  const filteredTags = availableTags.filter(tag => 
    !selected.includes(tag) && 
    tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  // If read-only mode, just display the tags
  if (readOnly) {
    if (!selected || selected.length === 0) {
      return (
        <div className="text-muted-foreground text-sm">
          {t('callLogs.noTags')}
        </div>
      );
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {selected.map(tag => (
          <Badge key={tag} variant="secondary" className={isSmall ? "text-xs py-0 px-2" : ""}>
            <TagIcon className={`mr-1 ${isSmall ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
            {tag}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {selected.map(tag => (
        <Badge key={tag} variant="secondary" className={isSmall ? "text-xs py-0 px-2" : ""}>
          <TagIcon className={`mr-1 ${isSmall ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
          {tag}
          <button 
            className="ml-1 text-muted-foreground hover:text-foreground" 
            onClick={() => handleRemove(tag)}
          >
            <X className={isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        </Badge>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size={isSmall ? "sm" : "default"} 
            className={isSmall ? "h-7 text-xs" : ""}
          >
            <Plus className={`mr-1 ${isSmall ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
            {t('callLogs.addTag')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-60" align="start">
          <Command>
            <CommandInput 
              placeholder={t('callLogs.searchTags')} 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 px-3 text-sm">
                  {t('callLogs.noTagsFound')}
                  <div className="mt-1 flex items-center">
                    <Input 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      size={5}
                      className="h-7 text-sm"
                      placeholder={t('callLogs.newTagName')}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-1 px-2 h-7"
                      onClick={handleCreateTag}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CommandEmpty>
              <CommandGroup heading={t('callLogs.availableTags')}>
                {filteredTags.slice(0, 10).map(tag => (
                  <CommandItem 
                    key={tag} 
                    value={tag}
                    onSelect={() => handleSelect(tag)}
                  >
                    <div className="flex items-center">
                      <TagIcon className="mr-2 h-4 w-4" />
                      {tag}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t('callLogs.createNew')}>
                    <CommandItem onSelect={handleCreateTag}>
                      <div className="flex items-center">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('callLogs.createTag')}: "{inputValue}"
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CallTagSelector;