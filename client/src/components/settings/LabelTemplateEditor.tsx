import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Edit, HelpCircle, Eye, Save, RotateCcw } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Template schema
const templateEditSchema = z.object({
  content: z.string().min(1, 'Template content is required'),
});

// Template editor component
const LabelTemplateEditor: React.FC = () => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState('shipping-label');
  const [isEditing, setIsEditing] = useState(false);
  const [showVariableHelp, setShowVariableHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("edit");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // Template form
  const shippingLabelForm = useForm<z.infer<typeof templateEditSchema>>({
    resolver: zodResolver(templateEditSchema),
    defaultValues: {
      content: '',
    }
  });
  
  // Get template content query
  const { data: labelTemplateData, isLoading: isLoadingLabelTemplate, refetch: refetchLabelTemplate } = useQuery({
    queryKey: ['/api/label-templates', selectedTemplate],
    enabled: !!selectedTemplate,
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/label-templates/${selectedTemplate}`, {
          method: 'GET',
        });
        return response;
      } catch (error) {
        // Return null if template not found or error occurs
        if (error instanceof Error && error.message.includes('404')) {
          return { templateName: selectedTemplate, content: '' };
        }
        throw error;
      }
    }
  });
  
  // Effect to update form when template data changes
  useEffect(() => {
    if (labelTemplateData && labelTemplateData.content !== undefined) {
      shippingLabelForm.reset({
        content: labelTemplateData.content,
      });
    }
  }, [labelTemplateData, shippingLabelForm]);
  
  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof templateEditSchema>) => {
      return apiRequest(`/api/label-templates/${selectedTemplate}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "The label template has been updated successfully.",
      });
      setIsEditing(false);
      refetchLabelTemplate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update template. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });
  
  // Preview template mutation
  const previewTemplateMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/label-templates/${selectedTemplate}/preview`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: (data) => {
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setActiveTab("preview");
      } else {
        toast({
          title: "Preview Error",
          description: "Failed to generate preview URL",
          variant: "destructive",
        });
      }
      setIsGeneratingPreview(false);
    },
    onError: (error) => {
      toast({
        title: "Preview Error",
        description: "Failed to generate preview. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
      setIsGeneratingPreview(false);
    }
  });
  
  // Generate preview
  const handleGeneratePreview = () => {
    const content = shippingLabelForm.getValues().content;
    if (!content) {
      toast({
        title: "Error",
        description: "Template content is required to generate a preview",
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingPreview(true);
    previewTemplateMutation.mutate(content);
  };
  
  // Template selection options
  const templateOptions = [
    { value: 'shipping-label', label: 'Standard Shipping Label' },
    { value: 'product-label', label: 'Product Label' },
    { value: 'pallet-label', label: 'Pallet Label' },
  ];
  
  // Available variables for templates
  const availableVariables = [
    { name: "orderNumber", description: "Order number/ID" },
    { name: "customerName", description: "Customer's full name" },
    { name: "customerAddress", description: "Customer's full address" },
    { name: "customerCity", description: "Customer's city" },
    { name: "customerPostalCode", description: "Customer's postal code" },
    { name: "customerCountry", description: "Customer's country" },
    { name: "shippingCompany", description: "Name of shipping company used" },
    { name: "trackingNumber", description: "Shipping tracking number (if available)" },
    { name: "companyName", description: "Your company name (from settings)" },
    { name: "shippingDate", description: "The shipping date" },
  ];
  
  // Insert a variable at cursor position
  const insertVariable = (variable: string) => {
    // Get textarea element
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = shippingLabelForm.getValues().content;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    // Insert the variable at cursor position
    const newText = `${before}{${variable}}${after}`;
    shippingLabelForm.setValue('content', newText);
    
    // Set focus back to textarea and place cursor after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length + 2; // +2 for the {}
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  
  // Handler for template form submission
  const onTemplateSubmit = (values: z.infer<typeof templateEditSchema>) => {
    updateTemplateMutation.mutate(values);
  };
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Shipping Label Editor</CardTitle>
        <CardDescription>
          Edit the shipping label template for the CAB EOS1 printer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Select 
              value={selectedTemplate} 
              onValueChange={(value) => {
                setSelectedTemplate(value);
                setIsEditing(false);
              }}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <Button onClick={() => console.log("Button clicked")}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Label Template</DialogTitle>
                  <DialogDescription>
                    Edit the template for {templateOptions.find(t => t.value === selectedTemplate)?.label}
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs 
                  value={activeTab} 
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="edit">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Template
                    </TabsTrigger>
                    <TabsTrigger value="preview" disabled={!previewUrl && !isGeneratingPreview}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="edit" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Edit template</h4>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowVariableHelp(!showVariableHelp)}
                        >
                          <HelpCircle className="h-4 w-4 mr-2" />
                          {showVariableHelp ? "Hide Variables" : "Show Variables"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGeneratePreview}
                          disabled={isGeneratingPreview || !shippingLabelForm.getValues().content}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {isGeneratingPreview ? "Generating..." : "Generate Preview"}
                        </Button>
                      </div>
                    </div>
                    
                    {showVariableHelp && (
                      <div className="bg-slate-50 p-4 rounded-md mb-4">
                        <h5 className="font-medium mb-2">Available Variables</h5>
                        <p className="text-sm mb-2">Click a variable to insert it at cursor position:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableVariables.map((variable) => (
                            <Badge 
                              key={variable.name} 
                              variant="outline" 
                              className="cursor-pointer hover:bg-slate-100"
                              onClick={() => insertVariable(variable.name)}
                            >
                              {variable.name}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-slate-500">
                            <strong>Variable format:</strong> Use <code className="bg-slate-100 px-1">{"{variable_name}"}</code>
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <Form {...shippingLabelForm}>
                      <div className="space-y-4">
                        <FormField
                          control={shippingLabelForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template JScript</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field} 
                                  className="font-mono text-sm h-[300px]"
                                  spellCheck={false}
                                />
                              </FormControl>
                              <FormDescription>
                                JScript code for label printing. Variable format: {`{variable_name}`}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Form>
                  </TabsContent>
                  
                  <TabsContent value="preview" className="space-y-4">
                    {isGeneratingPreview ? (
                      <div className="flex flex-col items-center justify-center p-8">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                        <p className="text-muted-foreground">Generating preview...</p>
                      </div>
                    ) : previewUrl ? (
                      <div className="flex flex-col space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Label Preview</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("edit")}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Back to Editor
                          </Button>
                        </div>
                        <div className="border rounded-md overflow-hidden bg-gray-50">
                          <iframe 
                            src={previewUrl} 
                            className="w-full h-[500px] border-0"
                            title="Label Preview"
                          ></iframe>
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                          This is a simplified preview. The actual label will be rendered by the printer.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8">
                        <p className="text-muted-foreground">No preview available. Generate a preview first.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <DialogFooter className="mt-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false);
                      setActiveTab("edit");
                      setPreviewUrl(null);
                      if (labelTemplateData && labelTemplateData.content) {
                        shippingLabelForm.reset({
                          content: labelTemplateData.content,
                        });
                      }
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={shippingLabelForm.handleSubmit(onTemplateSubmit)}
                    disabled={updateTemplateMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {isLoadingLabelTemplate ? (
            <div className="text-center py-4">
              <div className="flex justify-center items-center gap-2">
                <span className="animate-spin">
                  <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                <span>Loading template...</span>
              </div>
            </div>
          ) : labelTemplateData && labelTemplateData.content ? (
            <div className="mt-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-blue-800">Template Loaded</AlertTitle>
                <AlertDescription className="text-blue-800">
                  The template for {templateOptions.find(t => t.value === selectedTemplate)?.label} is loaded. Click Edit Template to modify it.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="mt-4">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTitle className="text-yellow-800">Template Not Found</AlertTitle>
                <AlertDescription className="text-yellow-800">
                  This template doesn't exist yet. Click Edit Template to create it.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LabelTemplateEditor;