import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const ShippingLabel: React.FC = () => {
  const params = useParams();
  const [location] = useLocation();
  const [order, setOrder] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxCount, setBoxCount] = useState(1);
  const [currentBox, setCurrentBox] = useState(1);

  // Get the order ID from the URL
  const orderId = params.id ? parseInt(params.id) : null;
  
  // Parse box numbers from query params if they exist
  useEffect(() => {
    const url = new URL(window.location.href);
    const boxParam = url.searchParams.get('box');
    const totalParam = url.searchParams.get('total');
    
    if (boxParam && !isNaN(parseInt(boxParam))) {
      setCurrentBox(parseInt(boxParam));
    }
    
    if (totalParam && !isNaN(parseInt(totalParam))) {
      setBoxCount(parseInt(totalParam));
    }
  }, [location]);

  const [labelHtml, setLabelHtml] = useState<string | null>(null);

  useEffect(() => {
    // Load data from new shipping label API
    const loadData = async () => {
      if (!orderId) return;

      try {
        // First get basic order info
        const orderResponse = await fetch(`/api/orders/${orderId}`);
        if (!orderResponse.ok) {
          console.error("Failed to load order");
          return;
        }
        const orderData = await orderResponse.json();
        setOrder(orderData);

        // Now get the shipping label from our new API endpoint
        console.log(`Using user-specified box count: ${boxCount}`);
        const labelResponse = await fetch(`/api/orders/${orderId}/new-shipping-label?boxNumber=${currentBox}&boxCount=${boxCount}`);
        
        if (labelResponse.ok) {
          const labelData = await labelResponse.json();
          if (labelData.html) {
            setLabelHtml(labelData.html);
          }
          
          // Set minimal customer data
          setCustomer({
            name: orderData.customerName,
            address: "Not available",
            phone: "Not available",
            city: "",
            country: "",
            custom_shipping_company: null,
            preferred_shipping_company: null
          });
        } else {
          console.error("Failed to load shipping label template");
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId]);

  const printLabel = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-center">Loading shipping label...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center">Order not found</div>;
  }

  // Format customer address
  const formatAddress = () => {
    if (!customer) return "";
    
    const addressParts = [
      customer.address,
      customer.city,
      customer.state,
      customer.postalCode,
      customer.country
    ].filter(Boolean);
    
    return addressParts.join(", ");
  };
  
  // Determine shipping company display - force N/A
  const getShippingCompany = () => {
    // Hard-coded to N/A as requested
    return "N/A";
  };
  
  // Log customer data for debugging
  console.log("Customer shipping data:", {
    custom_shipping_company: customer?.custom_shipping_company,
    preferred_shipping_company: customer?.preferred_shipping_company
  });

  const handleBoxChange = async (boxNum: number) => {
    setCurrentBox(boxNum);
    if (orderId) {
      try {
        const response = await fetch(`/api/orders/${orderId}/new-shipping-label?boxNumber=${boxNum}&boxCount=${boxCount}`);
        if (response.ok) {
          const data = await response.json();
          setLabelHtml(data.html);
        }
      } catch (err) {
        console.error("Error updating box number:", err);
      }
    }
  };

  const handleBoxCountChange = async (count: number) => {
    setBoxCount(count);
    if (orderId) {
      try {
        // If current box is greater than new count, adjust it
        const newCurrentBox = currentBox > count ? count : currentBox;
        setCurrentBox(newCurrentBox);
        
        const response = await fetch(`/api/orders/${orderId}/new-shipping-label?boxNumber=${newCurrentBox}&boxCount=${count}`);
        if (response.ok) {
          const data = await response.json();
          setLabelHtml(data.html);
        }
      } catch (err) {
        console.error("Error updating box count:", err);
      }
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold mb-4">Shipping Label</h1>
        <div className="flex justify-between mb-4">
          <div>
            <p>Order: {order?.orderNumber}</p>
            <p>Customer: {order?.customerName}</p>
          </div>
          <div>
            <Button 
              onClick={printLabel}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="mr-2 h-4 w-4" /> Print Label
            </Button>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Box Number:</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min={1}
              max={boxCount}
              value={currentBox}
              onChange={e => handleBoxChange(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded"
            />
            <span>of</span>
            <input
              type="number"
              min={1}
              value={boxCount}
              onChange={e => handleBoxCountChange(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded"
            />
            <span>boxes</span>
          </div>
        </div>
      </div>

      {/* Server-generated Shipping Label */}
      {labelHtml ? (
        <div className="border border-gray-300 rounded-md bg-white print:border-0 print:p-0 print:shadow-none">
          <iframe 
            srcDoc={labelHtml}
            style={{ width: "100%", height: "300px", border: "none" }}
            title="Shipping Label"
            id="shipping-label-frame"
          />
        </div>
      ) : (
        <div className="text-center p-4 border rounded">
          {loading ? "Loading shipping label..." : "No label template available"}
        </div>
      )}
    </div>
  );
};

export default ShippingLabel;