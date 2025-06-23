import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TemplateEditorProps {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  placeholder?: string;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  title,
  description,
  value,
  onChange,
  variables,
  placeholder
}) => {
  const form = useForm({
    defaultValues: { template: value },
    values: { template: value }
  });

  const handleTemplateChange = (newValue: string) => {
    form.setValue("template", newValue);
    onChange(newValue);
  };

  const insertVariable = (variable: string) => {
    const currentValue = form.getValues("template");
    const newValue = currentValue + `{${variable}}`;
    handleTemplateChange(newValue);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Available Variables</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {variables.map((variable) => (
              <Badge
                key={variable}
                variant="outline"
                className="cursor-pointer hover:bg-secondary"
                onClick={() => insertVariable(variable)}
              >
                {`{${variable}}`}
              </Badge>
            ))}
          </div>
        </div>
        
        <Form {...form}>
          <FormField
            control={form.control}
            name="template"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={placeholder || "Enter your template content..."}
                    className="min-h-[120px] font-mono text-sm"
                    {...field}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  Click on variable badges above to insert them into your template.
                  Variables will be replaced with actual values when notifications are sent.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>

        {value && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <label className="text-sm font-medium">Preview:</label>
            <pre className="text-sm mt-1 whitespace-pre-wrap">{value}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TemplateEditor;