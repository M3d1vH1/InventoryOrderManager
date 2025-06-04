import React from 'react';
import { Icon, ActionIcon } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  faHome,
  faUser,
  faShoppingCart,
  faSearch,
  faEdit,
  faTrash,
  faCog,
  faPlus,
  NavigationIcons,
  ActionIcons,
  BusinessIcons,
  StatusIcons
} from '@/lib/icons';
import { CheckCircle, AlertTriangle, Package } from 'lucide-react';

/**
 * FontAwesome Optimization Component
 * Demonstrates the complete migration strategy and benefits
 */
export function FontAwesomeOptimization() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">FontAwesome Bundle Optimization</h3>
        <Badge variant="destructive" className="text-sm">
          Potential Savings: 300KB (90% reduction)
        </Badge>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Current Issue Detected</AlertTitle>
        <AlertDescription>
          Your project imports the entire FontAwesome library (~300KB) but likely uses only 20-30 icons.
          This optimization can reduce your bundle by up to 90%.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">Before vs After</TabsTrigger>
          <TabsTrigger value="implementation">Implementation</TabsTrigger>
          <TabsTrigger value="migration">Migration Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Before */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700">Current: Global CSS Import</CardTitle>
                <CardDescription>Loading entire FontAwesome library</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-red-50 p-3 rounded">
                  <code className="text-sm">
                    @import url('/@fortawesome/fontawesome-free/css/all.min.css');
                  </code>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                    &lt;i className="fas fa-home"&gt;&lt;/i&gt;
                  </div>
                  <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                    &lt;i className="fas fa-user"&gt;&lt;/i&gt;
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <div className="text-red-600">❌ Loads 1,600+ icons</div>
                  <div className="text-red-600">❌ No tree-shaking</div>
                  <div className="text-red-600">❌ 300KB bundle size</div>
                </div>
              </CardContent>
            </Card>

            {/* After */}
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-700">Optimized: Selective Imports</CardTitle>
                <CardDescription>Tree-shakable React components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-green-50 p-3 rounded">
                  <code className="text-sm">
                    import {`{ faHome, faUser }`} from '@/lib/icons';
                  </code>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                    &lt;Icon icon={`{faHome}`} /&gt;
                  </div>
                  <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                    &lt;Icon icon={`{faUser}`} /&gt;
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <div className="text-green-600">✓ Only loads used icons</div>
                  <div className="text-green-600">✓ Full tree-shaking</div>
                  <div className="text-green-600">✓ 20-50KB bundle size</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Live Demo: Optimized Icons</CardTitle>
              <CardDescription>
                These icons demonstrate the new optimized approach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center space-y-2">
                  <Icon icon={faHome} size="2xl" className="text-blue-600" />
                  <div className="text-xs">Home</div>
                </div>
                <div className="text-center space-y-2">
                  <Icon icon={faUser} size="2xl" className="text-green-600" />
                  <div className="text-xs">User</div>
                </div>
                <div className="text-center space-y-2">
                  <Icon icon={faShoppingCart} size="2xl" className="text-purple-600" />
                  <div className="text-xs">Cart</div>
                </div>
                <div className="text-center space-y-2">
                  <Icon icon={faCog} size="2xl" className="text-gray-600" />
                  <div className="text-xs">Settings</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Commands</CardTitle>
              <CardDescription>
                Step-by-step commands to implement the optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">1. Install React FontAwesome (Already Done)</h4>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                    npm install @fortawesome/react-fontawesome @fortawesome/fontawesome-svg-core<br/>
                    npm install @fortawesome/free-solid-svg-icons @fortawesome/free-regular-svg-icons
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Remove Global FontAwesome CSS</h4>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                    # Delete or comment out in your CSS files:<br/>
                    # @import url('/@fortawesome/fontawesome-free/css/all.min.css');
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Import Icon Library</h4>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                    # Add to your main App.tsx:<br/>
                    import '@/lib/icons';
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Uninstall Old Package</h4>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                    npm uninstall @fortawesome/fontawesome-free
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Migration Examples</CardTitle>
              <CardDescription>
                How to convert existing FontAwesome usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Basic Icon Replacement</h4>
                  <div className="space-y-2">
                    <div className="bg-red-50 p-2 rounded">
                      <span className="text-red-600 text-sm">Before:</span>
                      <code className="ml-2 text-sm">&lt;i className="fas fa-home"&gt;&lt;/i&gt;</code>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <span className="text-green-600 text-sm">After:</span>
                      <code className="ml-2 text-sm">&lt;Icon icon={`{faHome}`} /&gt;</code>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Button with Icon</h4>
                  <div className="space-y-2">
                    <div className="bg-red-50 p-2 rounded">
                      <span className="text-red-600 text-sm">Before:</span>
                      <code className="ml-2 text-sm">&lt;button&gt;&lt;i className="fas fa-plus"&gt;&lt;/i&gt; Add&lt;/button&gt;</code>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <span className="text-green-600 text-sm">After:</span>
                      <code className="ml-2 text-sm">&lt;Button&gt;&lt;Icon icon={`{faPlus}`} className="mr-2" /&gt; Add&lt;/Button&gt;</code>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Action Button</h4>
                  <div className="space-y-2">
                    <div className="bg-red-50 p-2 rounded">
                      <span className="text-red-600 text-sm">Before:</span>
                      <code className="ml-2 text-sm">&lt;button onClick={`{handleEdit}`}&gt;&lt;i className="fas fa-edit"&gt;&lt;/i&gt;&lt;/button&gt;</code>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <span className="text-green-600 text-sm">After:</span>
                      <code className="ml-2 text-sm">&lt;ActionIcon icon={`{faEdit}`} onClick={`{handleEdit}`} /&gt;</code>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Migration Benefits</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    <li>Bundle size reduction: 250-280KB</li>
                    <li>Faster initial page load</li>
                    <li>Better tree-shaking</li>
                    <li>TypeScript support</li>
                    <li>Consistent icon sizing</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FontAwesomeOptimization;