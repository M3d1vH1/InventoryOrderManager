import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  placeholder: string;
  title: string;
  description: string;
}

export function TemplateEditor({
  value,
  onChange,
  variables,
  placeholder,
  title,
  description
}: TemplateEditorProps) {
  const [cursorPosition, setCursorPosition] = useState(0);

  const insertVariable = (variable: string) => {
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    const newValue = beforeCursor + `{${variable}}` + afterCursor;
    onChange(newValue);
    setCursorPosition(cursorPosition + variable.length + 2);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaSelect = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCursorPosition(e.target.selectionStart);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Available Variables</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {variables.map((variable) => (
              <Badge
                key={variable}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => insertVariable(variable)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {variable}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Template Content</Label>
          <Textarea
            value={value}
            onChange={handleTextareaChange}
            onSelect={handleTextareaSelect}
            placeholder={placeholder}
            rows={6}
            className="mt-2 font-mono text-sm"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Click on variables above to insert them at cursor position.</p>
          <p>Variables will be replaced with actual values when notifications are sent.</p>
        </div>
      </CardContent>
    </Card>
  );
}