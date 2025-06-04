# FontAwesome Migration Examples

## Icon Replacements

### Before (CSS Classes)
```jsx
<i className="fas fa-home"></i>
<i className="fas fa-user"></i>
<i className="fas fa-cog"></i>
<i className="fas fa-search"></i>
<i className="fas fa-plus"></i>
<i className="fas fa-edit"></i>
<i className="fas fa-trash"></i>
```

### After (React Components)
```jsx
import { Icon } from '@/components/ui/icon';
import { faHome, faUser, faCog, faSearch, faPlus, faEdit, faTrash } from '@/lib/icons';

<Icon icon={faHome} />
<Icon icon={faUser} />
<Icon icon={faCog} />
<Icon icon={faSearch} />
<Icon icon={faPlus} />
<Icon icon={faEdit} />
<Icon icon={faTrash} />
```

## Button Examples

### Before
```jsx
<button><i className="fas fa-plus"></i> Add Item</button>
<button onClick={handleEdit}><i className="fas fa-edit"></i></button>
```

### After
```jsx
import { Button } from '@/components/ui/button';
import { Icon, ActionIcon } from '@/components/ui/icon';
import { faPlus, faEdit } from '@/lib/icons';

<Button><Icon icon={faPlus} className="mr-2" /> Add Item</Button>
<ActionIcon icon={faEdit} onClick={handleEdit} />
```

## Size Comparison
- Before: 300KB (all FontAwesome CSS + fonts)
- After: 20-50KB (only imported icons)
- Savings: 250-280KB (90% reduction)
