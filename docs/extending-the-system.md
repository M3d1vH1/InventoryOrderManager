# Extending the Warehouse Management System

This guide provides instructions for developers who want to extend the Warehouse Management System with new features or modify existing functionality.

## Architecture Principles

When extending the system, follow these core principles:

1. **Separation of Concerns**: Keep frontend and backend code separate and well-organized
2. **Type Safety**: Use TypeScript types throughout the application
3. **Single Source of Truth**: Define data models in `shared/schema.ts` to be used by both frontend and backend
4. **Consistent Patterns**: Follow established patterns for CRUD operations, forms, and API endpoints
5. **Internationalization**: Ensure all user-visible text is properly internationalized

## Adding a New Feature

### Step 1: Define Data Model

Start by defining your data model in `shared/schema.ts`:

```typescript
// Example: Adding a supplier management feature
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Create insert schema using drizzle-zod
export const insertSupplierSchema = createInsertSchema(suppliers, {
  // Add any extra validation here
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Define types
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
```

### Step 2: Update Storage Interface

Add methods to `server/storage.ts` for the new entity:

```typescript
// Add to IStorage interface
export interface IStorage {
  // ... existing methods
  
  // Supplier methods
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | null>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | null>;
  deleteSupplier(id: number): Promise<boolean>;
  searchSuppliers(query: string): Promise<Supplier[]>;
}

// Then implement these methods in the PostgresStorage class
```

### Step 3: Create API Endpoints

Create a new file in `server/api/` for your endpoints:

```typescript
// server/api/suppliers.ts
import { Request, Response } from 'express';
import { storage } from '../storage';
import { insertSupplierSchema } from '../../shared/schema';

// Get all suppliers
export async function getAllSuppliers(req: Request, res: Response) {
  try {
    const suppliers = await storage.getAllSuppliers();
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Get single supplier
export async function getSupplier(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const supplier = await storage.getSupplier(id);
    
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Create supplier
export async function createSupplier(req: Request, res: Response) {
  try {
    // Validate input
    const result = insertSupplierSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid supplier data',
        errors: result.error.format() 
      });
    }
    
    const supplier = await storage.createSupplier(result.data);
    res.status(201).json(supplier);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Update supplier
export async function updateSupplier(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    
    // Partial validation for update
    const result = insertSupplierSchema.partial().safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid supplier data',
        errors: result.error.format() 
      });
    }
    
    const supplier = await storage.updateSupplier(id, result.data);
    
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Delete supplier
export async function deleteSupplier(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteSupplier(id);
    
    if (!success) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Search suppliers
export async function searchSuppliers(req: Request, res: Response) {
  try {
    const query = req.query.q as string;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const suppliers = await storage.searchSuppliers(query);
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
```

### Step 4: Register Routes

Add your new routes to `server/routes.ts`:

```typescript
import { 
  getAllSuppliers, getSupplier, createSupplier, 
  updateSupplier, deleteSupplier, searchSuppliers 
} from './api/suppliers';

export async function registerRoutes(app: Express): Promise<Server> {
  // ... existing routes
  
  // Supplier routes
  app.get('/api/suppliers', isAuthenticated, getAllSuppliers);
  app.get('/api/suppliers/:id', isAuthenticated, getSupplier);
  app.post('/api/suppliers', isAuthenticated, createSupplier);
  app.patch('/api/suppliers/:id', isAuthenticated, updateSupplier);
  app.delete('/api/suppliers/:id', isAuthenticated, deleteSupplier);
  
  // ... more routes
}
```

### Step 5: Create Frontend Components

Create React components for your feature:

1. **Create List Component**:

```tsx
// client/src/components/suppliers/SupplierList.tsx
import { useQuery } from '@tanstack/react-query';
import { Table } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import type { Supplier } from '@shared/schema';

export function SupplierList() {
  const { data: suppliers, isLoading, error } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });
  
  if (isLoading) return <div>Loading suppliers...</div>;
  if (error) return <div>Error loading suppliers</div>;
  
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Suppliers</h2>
        <Button asChild>
          <Link href="/suppliers/new">Add Supplier</Link>
        </Button>
      </div>
      
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact Person</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {suppliers?.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.contactPerson}</td>
              <td>{supplier.email}</td>
              <td>{supplier.phone}</td>
              <td>
                <Button variant="ghost" asChild size="sm">
                  <Link href={`/suppliers/${supplier.id}`}>View</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

2. **Create Form Component**:

```tsx
// client/src/components/suppliers/SupplierForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { insertSupplierSchema, type InsertSupplier } from '@shared/schema';

interface SupplierFormProps {
  initialData?: Partial<InsertSupplier>;
  supplierId?: number;
}

export function SupplierForm({ initialData = {}, supplierId }: SupplierFormProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!supplierId;
  
  // Setup form with validation
  const form = useForm<InsertSupplier>({
    resolver: zodResolver(insertSupplierSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      ...initialData
    }
  });
  
  // Create mutation
  const createSupplierMutation = useMutation({
    mutationFn: async (data: InsertSupplier) => {
      return apiRequest('/api/suppliers', { method: 'POST', data });
    },
    onSuccess: () => {
      toast({
        title: 'Supplier created',
        description: 'The supplier has been created successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      navigate('/suppliers');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create supplier. Please try again.',
        variant: 'destructive'
      });
      console.error('Error creating supplier:', error);
    }
  });
  
  // Update mutation
  const updateSupplierMutation = useMutation({
    mutationFn: async (data: Partial<InsertSupplier>) => {
      return apiRequest(`/api/suppliers/${supplierId}`, { method: 'PATCH', data });
    },
    onSuccess: () => {
      toast({
        title: 'Supplier updated',
        description: 'The supplier has been updated successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${supplierId}`] });
      navigate('/suppliers');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update supplier. Please try again.',
        variant: 'destructive'
      });
      console.error('Error updating supplier:', error);
    }
  });
  
  // Handle form submission
  const onSubmit = (data: InsertSupplier) => {
    if (isEditing) {
      updateSupplierMutation.mutate(data);
    } else {
      createSupplierMutation.mutate(data);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Form.Field
          control={form.control}
          name="name"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Name</Form.Label>
              <Form.Control>
                <Input {...field} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        
        <Form.Field
          control={form.control}
          name="contactPerson"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Contact Person</Form.Label>
              <Form.Control>
                <Input {...field} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        
        <Form.Field
          control={form.control}
          name="email"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Email</Form.Label>
              <Form.Control>
                <Input type="email" {...field} value={field.value || ''} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        
        <Form.Field
          control={form.control}
          name="phone"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Phone</Form.Label>
              <Form.Control>
                <Input {...field} value={field.value || ''} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        
        <Form.Field
          control={form.control}
          name="address"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Address</Form.Label>
              <Form.Control>
                <Textarea {...field} value={field.value || ''} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        
        <Form.Field
          control={form.control}
          name="notes"
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Notes</Form.Label>
              <Form.Control>
                <Textarea {...field} value={field.value || ''} />
              </Form.Control>
              <Form.Message />
            </Form.Item>
          )}
        />
        
        <div className="flex gap-2">
          <Button type="submit" disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}>
            {isEditing ? 'Update Supplier' : 'Create Supplier'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/suppliers')}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Step 6: Create Pages

Create pages for your feature:

```tsx
// client/src/pages/Suppliers.tsx
import { SupplierList } from '@/components/suppliers/SupplierList';

export function SuppliersPage() {
  return (
    <div className="container py-8">
      <SupplierList />
    </div>
  );
}

// client/src/pages/SupplierDetail.tsx
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import type { Supplier } from '@shared/schema';

export function SupplierDetailPage() {
  const [, params] = useRoute('/suppliers/:id');
  const supplierId = params?.id ? parseInt(params.id) : undefined;
  
  const { data: supplier, isLoading, error } = useQuery<Supplier>({
    queryKey: [`/api/suppliers/${supplierId}`],
    enabled: !!supplierId && supplierId !== 0,
  });
  
  if (isLoading) return <div>Loading supplier details...</div>;
  if (error) return <div>Error loading supplier</div>;
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Edit Supplier</h1>
      <SupplierForm initialData={supplier} supplierId={supplierId} />
    </div>
  );
}

// client/src/pages/SupplierNew.tsx
import { SupplierForm } from '@/components/suppliers/SupplierForm';

export function SupplierNewPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Add New Supplier</h1>
      <SupplierForm />
    </div>
  );
}
```

### Step 7: Add Routes

Update your router in `client/src/App.tsx`:

```tsx
import { Route, Switch } from 'wouter';
import { SuppliersPage } from './pages/Suppliers';
import { SupplierDetailPage } from './pages/SupplierDetail';
import { SupplierNewPage } from './pages/SupplierNew';

function App() {
  return (
    <div className="app">
      <MainLayout>
        <Switch>
          {/* Existing routes */}
          
          {/* New supplier routes */}
          <Route path="/suppliers" component={SuppliersPage} />
          <Route path="/suppliers/new" component={SupplierNewPage} />
          <Route path="/suppliers/:id" component={SupplierDetailPage} />
          
          {/* More routes */}
        </Switch>
      </MainLayout>
    </div>
  );
}
```

### Step 8: Add Translations

Update translation files for internationalization:

```json
// client/src/i18n/translations/en.json
{
  "suppliers": {
    "title": "Suppliers",
    "newSupplier": "Add Supplier",
    "editSupplier": "Edit Supplier",
    "name": "Name",
    "contactPerson": "Contact Person",
    "email": "Email",
    "phone": "Phone",
    "address": "Address",
    "notes": "Notes",
    "actions": "Actions",
    "view": "View",
    "edit": "Edit",
    "delete": "Delete",
    "cancel": "Cancel",
    "save": "Save",
    "created": "Supplier created successfully",
    "updated": "Supplier updated successfully",
    "deleted": "Supplier deleted successfully",
    "confirmDelete": "Are you sure you want to delete this supplier?"
  }
}

// client/src/i18n/translations/el.json
{
  "suppliers": {
    "title": "Προμηθευτές",
    "newSupplier": "Προσθήκη Προμηθευτή",
    "editSupplier": "Επεξεργασία Προμηθευτή",
    "name": "Όνομα",
    "contactPerson": "Πρόσωπο Επικοινωνίας",
    "email": "Email",
    "phone": "Τηλέφωνο",
    "address": "Διεύθυνση",
    "notes": "Σημειώσεις",
    "actions": "Ενέργειες",
    "view": "Προβολή",
    "edit": "Επεξεργασία",
    "delete": "Διαγραφή",
    "cancel": "Ακύρωση",
    "save": "Αποθήκευση",
    "created": "Ο προμηθευτής δημιουργήθηκε με επιτυχία",
    "updated": "Ο προμηθευτής ενημερώθηκε με επιτυχία",
    "deleted": "Ο προμηθευτής διαγράφηκε με επιτυχία",
    "confirmDelete": "Είστε βέβαιοι ότι θέλετε να διαγράψετε αυτόν τον προμηθευτή;"
  }
}
```

### Step 9: Add Navigation Link

Update the sidebar to include your new feature:

```tsx
// client/src/components/Sidebar.tsx
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'wouter';
import { LuTruck } from 'react-icons/lu'; // Import appropriate icon

export function Sidebar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  
  return (
    <div className="sidebar">
      {/* Existing navigation items */}
      
      <Link href="/suppliers" className={location.startsWith('/suppliers') ? 'active' : ''}>
        <LuTruck className="icon" />
        <span>{t('suppliers.title')}</span>
      </Link>
      
      {/* More navigation items */}
    </div>
  );
}
```

### Step 10: Test and Refine

1. Test all CRUD operations for the new feature
2. Verify all UI elements are properly translated
3. Check for proper error handling and validation feedback
4. Optimize any slow queries or operations
5. Ensure the feature is responsive on all screen sizes

## Advanced Extensions

### Adding Relationships

To add relationships between entities:

```typescript
// Example: Link suppliers to products
export const products = pgTable('products', {
  // existing fields
  supplierId: integer('supplier_id').references(() => suppliers.id),
});

// Update types and schemas accordingly
```

### Adding File Uploads

For features requiring file uploads:

1. Add a storage path in the server
2. Create upload endpoints with multer middleware
3. Create frontend components with file input handling
4. Store file paths in the database

### Adding Real-time Updates

For real-time features:

1. Use the existing WebSocket server in `server/routes.ts`
2. Add new message types for your feature
3. Broadcast changes when data is modified
4. Subscribe to WebSocket events in your components

## Best Practices

1. **Keep Components Small**: Break large components into smaller, focused ones
2. **Use Custom Hooks**: Extract complex logic into reusable hooks
3. **Optimize Queries**: Use proper indexes and limit query results
4. **Handle Errors Gracefully**: Provide user-friendly error messages
5. **Write Tests**: Add tests for critical functionality
6. **Follow Naming Conventions**: Use consistent naming throughout the codebase
7. **Document Your Code**: Add comments for complex logic and JSDoc for functions
8. **Respect the Architecture**: Maintain the separation between UI, business logic, and data access

## Updating Dependencies

When you need to add new dependencies:

```
# DO NOT modify package.json directly or use npm/yarn commands
# Use the packager_tool from the Replit interface
```

## Database Migrations

For schema changes:

1. Update the model in `shared/schema.ts`
2. Use `npm run db:push` to apply changes to the database
3. Handle data migrations if needed with custom SQL or code