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

  useEffect(() => {
    // Load order and customer data
    const loadData = async () => {
      if (!orderId) return;

      try {
        // Fetch order data
        const orderResponse = await fetch(`/api/orders/${orderId}`);
        if (!orderResponse.ok) {
          console.error("Failed to load order");
          return;
        }
        const orderData = await orderResponse.json();
        setOrder(orderData);

        // Fetch customer data
        if (orderData.customerName) {
          try {
            // Use the customerName to search for matching customer
            console.log("Searching for customer:", orderData.customerName);
            const customerResponse = await fetch(`/api/customers/search?q=${encodeURIComponent(orderData.customerName)}`);
            
            if (customerResponse.ok) {
              const customers = await customerResponse.json();
              console.log("Found customers:", customers);
              
              if (customers.length > 0) {
                setCustomer(customers[0]);
              } else {
                console.log("No matching customers found");
                // Set a minimal customer object using order data
                setCustomer({
                  name: orderData.customerName,
                  address: "Not available",
                  phone: "Not available",
                  city: "",
                  country: "",
                  custom_shipping_company: null,
                  preferred_shipping_company: null
                });
              }
            } else {
              console.error("Customer API returned error:", await customerResponse.text());
              // Set a minimal customer object using order data
              setCustomer({
                name: orderData.customerName,
                address: "Not available",
                phone: "Not available",
                city: "",
                country: "",
                custom_shipping_company: null,
                preferred_shipping_company: null
              });
            }
          } catch (err) {
            console.error("Error fetching customer data:", err);
            // Set a minimal customer object using order data
            setCustomer({
              name: orderData.customerName,
              address: "Not available",
              phone: "Not available",
              city: "",
              country: "",
              custom_shipping_company: null,
              preferred_shipping_company: null
            });
          }
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
  
  // Log customer data for debugging
  console.log("Customer shipping data:", {
    custom_shipping_company: customer?.custom_shipping_company,
    preferred_shipping_company: customer?.preferred_shipping_company
  });

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold mb-4">Shipping Label</h1>
        <div className="flex justify-between mb-4">
          <div>
            <p>Order: {order.orderNumber}</p>
            <p>Customer: {order.customerName}</p>
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
              onChange={e => setCurrentBox(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded"
            />
            <span>of</span>
            <input
              type="number"
              min={1}
              value={boxCount}
              onChange={e => setBoxCount(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded"
            />
            <span>boxes</span>
          </div>
        </div>
      </div>

      {/* Actual Shipping Label */}
      <div className="border border-gray-300 rounded-md p-4 pt-2 bg-white print:border-0 print:p-0 print:shadow-none">
        <div className="text-center mb-4">
          <img 
            src={`${window.location.origin}/shipping-logo.png`}
            alt="Company Logo" 
            className="h-14 mx-auto"
            onError={(e) => {
              console.log("Logo load error, switching to fallback");
              console.log("Logo failed to load, trying SVG");
              // If the PNG fails, try the SVG as fallback
              e.currentTarget.src = `${window.location.origin}/simple-logo.svg`;
              // If SVG also fails, handle that error
              e.currentTarget.onerror = () => {
                console.log("Fallback logo also failed");
                // Create a text fallback
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  e.currentTarget.style.display = 'none';
                  const textLogo = document.createElement('div');
                  textLogo.textContent = "OLIVE OIL COMPANY";
                  textLogo.className = "text-xl font-bold";
                  parent.appendChild(textLogo);
                }
              };
            }}
          />
        </div>
        
        <div className="text-xl font-bold mb-4">
          Order: {order.orderNumber}
        </div>
        
        <div className="mb-4">
          <p className="font-semibold">Customer: {order.customerName}</p>
          <p>Address: {formatAddress()}</p>
          <p>Phone: {customer?.phone || ""}</p>
        </div>
        
        <div className="font-bold mb-4">
          Shipping: {
            customer?.custom_shipping_company ? customer.custom_shipping_company :
            (customer?.preferred_shipping_company && customer.preferred_shipping_company !== 'other' 
              ? customer.preferred_shipping_company 
              : "N/A")
          }
        </div>
        
        <div className="text-center font-bold p-1 border border-gray-300 bg-gray-100 my-2">
          BOX {currentBox} OF {boxCount}
        </div>
      </div>
    </div>
  );
};

export default ShippingLabel;