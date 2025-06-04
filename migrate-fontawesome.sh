#!/bin/bash

# FontAwesome Optimization Migration Script
# This script migrates from global CSS imports to tree-shakable React components
# Expected bundle size reduction: 250-300KB

echo "🎯 FontAwesome Bundle Optimization Migration"
echo "============================================="

# Step 1: Backup current FontAwesome CSS
echo "📦 Step 1: Backing up current FontAwesome configuration..."
if [ -f "client/src/assets/fontawesome.css" ]; then
    cp client/src/assets/fontawesome.css client/src/assets/fontawesome.css.backup
    echo "✓ Backup created: fontawesome.css.backup"
else
    echo "ℹ️  No fontawesome.css found to backup"
fi

# Step 2: Comment out global CSS import
echo "🚫 Step 2: Removing global FontAwesome CSS import..."
if [ -f "client/src/assets/fontawesome.css" ]; then
    sed -i 's|@import url.*fontawesome.*|/* MIGRATED: @import url('\''/@fortawesome/fontawesome-free/css/all.min.css'\''); */|g' client/src/assets/fontawesome.css
    echo "✓ Global CSS import commented out"
fi

# Step 3: Add icon library import to App.tsx
echo "📦 Step 3: Adding optimized icon library import..."
if [ -f "client/src/App.tsx" ]; then
    # Check if import already exists
    if ! grep -q "import '@/lib/icons'" client/src/App.tsx; then
        # Add import after existing imports
        sed -i '/import.*from.*react/a import "@/lib/icons";' client/src/App.tsx
        echo "✓ Icon library import added to App.tsx"
    else
        echo "ℹ️  Icon library import already exists in App.tsx"
    fi
else
    echo "⚠️  App.tsx not found - please manually add: import '@/lib/icons';"
fi

# Step 4: Create migration example
echo "📝 Step 4: Creating migration reference..."
cat > fontawesome-migration-examples.md << 'EOF'
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
EOF

echo "✓ Migration examples created: fontawesome-migration-examples.md"

# Step 5: Show current status
echo "📊 Step 5: Migration Status"
echo "=========================="

# Check if React FontAwesome packages are installed
if npm list @fortawesome/react-fontawesome >/dev/null 2>&1; then
    echo "✓ React FontAwesome packages installed"
else
    echo "⚠️  React FontAwesome packages not found"
    echo "   Run: npm install @fortawesome/react-fontawesome @fortawesome/fontawesome-svg-core"
fi

# Check if old package still exists
if npm list @fortawesome/fontawesome-free >/dev/null 2>&1; then
    echo "⚠️  Old FontAwesome package still installed (300KB)"
    echo "   Run: npm uninstall @fortawesome/fontawesome-free"
else
    echo "✓ Old FontAwesome package removed"
fi

# Check if icon library exists
if [ -f "client/src/lib/icons.ts" ]; then
    echo "✓ Optimized icon library available"
else
    echo "⚠️  Icon library not found at client/src/lib/icons.ts"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Replace <i className='fas fa-*'> with <Icon icon={fa*} /> throughout your codebase"
echo "2. Test your application to ensure all icons display correctly"
echo "3. Run 'npm uninstall @fortawesome/fontawesome-free' to remove old package"
echo "4. Run 'ANALYZE=true npm run build' to verify bundle size reduction"
echo ""
echo "Expected bundle size reduction: 250-300KB"