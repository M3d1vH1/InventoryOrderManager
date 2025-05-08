import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import PDFDocument from 'pdfkit';
import * as PDFKit from 'pdfkit';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

const router = Router();

// Helper function to create a PDF document
function createPdf() {
  const doc = new PDFDocument({ margin: 50 });
  
  // Add common elements like headers, footers, etc.
  doc.fontSize(25).font('Helvetica-Bold');
  
  return doc;
}

// Helper function to format dates
function formatDate(date: string | Date | null): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// Helper function to draw table in PDF
function drawTable(doc: PDFKit.PDFDocument, headers: string[], data: any[], startY: number, options: any = {}): number {
  const defaults = {
    fontSize: 10,
    headerFontSize: 10,
    rowHeight: 20,
    columnSpacing: 10,
    margins: { left: 50, right: 50 },
    columnWidths: []
  };
  
  const settings = { ...defaults, ...options };
  const pageWidth = doc.page.width;
  const tableWidth = pageWidth - settings.margins.left - settings.margins.right;
  
  // Calculate column widths if not provided
  if (settings.columnWidths.length === 0) {
    const colWidth = tableWidth / headers.length;
    settings.columnWidths = headers.map(() => colWidth);
  }
  
  // Draw headers
  let currentX = settings.margins.left;
  let currentY = startY;
  
  doc.font('Helvetica-Bold').fontSize(settings.headerFontSize);
  headers.forEach((header, i) => {
    doc.text(header, currentX, currentY, {
      width: settings.columnWidths[i],
      align: 'left'
    });
    currentX += settings.columnWidths[i] + settings.columnSpacing;
  });
  
  currentY += settings.rowHeight;
  
  // Draw a line under headers
  doc.moveTo(settings.margins.left, currentY).lineTo(pageWidth - settings.margins.right, currentY).stroke();
  currentY += 5; // Add some space after the line
  
  // Draw data rows
  doc.font('Helvetica').fontSize(settings.fontSize);
  
  data.forEach(row => {
    // Check if we need a new page
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 50;
    }
    
    currentX = settings.margins.left;
    
    headers.forEach((_, i) => {
      const value = row[i] !== undefined && row[i] !== null ? row[i].toString() : '';
      doc.text(value, currentX, currentY, {
        width: settings.columnWidths[i],
        align: 'left'
      });
      currentX += settings.columnWidths[i] + settings.columnSpacing;
    });
    
    currentY += settings.rowHeight;
  });
  
  return currentY; // Return the Y position after the table
}

// Helper function to get dispatch schedule data
async function getDispatchScheduleData(days: number) {
  // Get all orders
  const orders = await storage.getAllOrders();
  
  // Calculate the date for N days ago
  const dateNDaysAgo = new Date();
  dateNDaysAgo.setDate(dateNDaysAgo.getDate() - days);
  
  // Filter orders created within the last N days
  const recentOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    return orderDate >= dateNDaysAgo;
  });
  
  // Extract all unique customer names for batch lookup
  const customerNames = Array.from(new Set(recentOrders.map(order => order.customerName)));
  
  // Get all customers whose names are in the list
  const customers = await Promise.all(
    customerNames.map(async (name) => {
      const matchedCustomers = await storage.searchCustomers(name);
      // Find the best match (exact match or first result)
      return matchedCustomers.find(c => c.name === name) || matchedCustomers[0];
    })
  );
  
  // Create a mapping of customer names to customer data
  const customerMap = customers.reduce<Record<string, any>>((map, customer) => {
    if (customer) {
      map[customer.name] = customer;
    }
    return map;
  }, {});
  
  // Collect customer information for the orders
  return recentOrders.map((order) => {
    const customer = customerMap[order.customerName];
    
    // Determine shipping company based on available information
    let shippingCompany = "Not specified";
    if (customer) {
      if (customer.customShippingCompany) {
        shippingCompany = customer.customShippingCompany;
      } else if (customer.shippingCompany) {
        shippingCompany = customer.shippingCompany;
      } else if (customer.preferredShippingCompany) {
        shippingCompany = customer.preferredShippingCompany;
      }
    }
    
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      orderDate: order.orderDate,
      estimatedShippingDate: order.estimatedShippingDate,
      actualShippingDate: order.actualShippingDate,
      status: order.status,
      shippingCompany: shippingCompany
    };
  });
}

// Endpoint to get orders from the last week with estimated shipping dates
router.get('/dispatch-schedule', isAuthenticated, async (req, res) => {
  try {
    // Get days parameter (default to 7 for last week)
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    
    const dispatchSchedule = await getDispatchScheduleData(days);
    
    return res.json(dispatchSchedule);
  } catch (error) {
    console.error('Error fetching dispatch schedule:', error);
    return res.status(500).json({ error: 'Failed to fetch dispatch schedule' });
  }
});

// Temporary test endpoint without authentication
router.get('/test-pdf', async (req, res) => {
  try {
    // Create a simple test PDF document
    const doc = createPdf();
    
    // Add title and metadata
    doc.info.Title = 'Test PDF Document';
    doc.info.Author = 'Warehouse Management System';
    
    // Add some content
    doc.text('Test PDF Generation', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text('If you can see this text, PDF generation is working correctly!');
    doc.moveDown(1);
    doc.text(`Generated on: ${new Date().toLocaleString()}`);
    
    // Finalize and send the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=test.pdf');
    
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Error generating test PDF:', error);
    return res.status(500).json({ error: 'Failed to generate test PDF' });
  }
});

// PDF generation endpoint for dispatch schedule
router.get('/dispatch-schedule/pdf', isAuthenticated, async (req, res) => {
  try {
    // Get days parameter (default to 7 for last week)
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    
    const dispatchSchedule = await getDispatchScheduleData(days);
    
    // Create PDF document
    const doc = createPdf();
    
    // Add title and metadata
    doc.info.Title = 'Dispatch Schedule Report';
    doc.info.Author = 'Warehouse Management System';
    
    // Add report title
    doc.text(`Dispatch Schedule Report - Last ${days} Days`, { align: 'center' });
    doc.moveDown(0.5);
    
    // Add generated date
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' });
    doc.moveDown(1);
    
    // Define table headers and data
    const headers = [
      'Order #', 
      'Customer', 
      'Order Date', 
      'Est. Ship Date', 
      'Status', 
      'Ship Via'
    ];
    
    const data = dispatchSchedule.map(order => [
      order.orderNumber,
      order.customerName,
      formatDate(order.orderDate),
      formatDate(order.estimatedShippingDate),
      order.status,
      order.shippingCompany
    ]);
    
    // Set column widths (total width is ~ 500)
    const columnWidths = [70, 150, 80, 80, 60, 70];
    
    // Draw the table
    drawTable(doc, headers, data, doc.y, { columnWidths });
    
    // Finalize the PDF and send it to the client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=dispatch-schedule-${new Date().toISOString().split('T')[0]}.pdf`);
    
    doc.pipe(res);
    doc.end();
    
  } catch (error) {
    console.error('Error generating dispatch schedule PDF:', error);
    return res.status(500).json({ error: 'Failed to generate dispatch schedule PDF' });
  }
});

// Helper function to get shipping delays data
async function getShippingDelaysData() {
  // Get all orders
  const orders = await storage.getAllOrders();
  
  // Filter orders that have an estimated shipping date but haven't been shipped yet
  const now = new Date();
  const delayedOrders = orders.filter(order => {
    // Filter for orders that:
    // 1. Are not yet shipped (status is not 'shipped' or 'cancelled')
    // 2. Have an estimated shipping date that has already passed
    return (
      (order.status !== 'shipped' && order.status !== 'cancelled') &&
      order.estimatedShippingDate && 
      new Date(order.estimatedShippingDate) < now
    );
  });
  
  // Sort by delay duration (most delayed first)
  delayedOrders.sort((a, b) => {
    const dateA = new Date(a.estimatedShippingDate || 0);
    const dateB = new Date(b.estimatedShippingDate || 0);
    return dateA.getTime() - dateB.getTime(); // Oldest estimated date first (most delayed)
  });
  
  // Extract all unique customer names for batch lookup
  const customerNames = Array.from(new Set(delayedOrders.map(order => order.customerName)));
  
  // Get all customers whose names are in the list
  const customers = await Promise.all(
    customerNames.map(async (name) => {
      const matchedCustomers = await storage.searchCustomers(name);
      return matchedCustomers.find(c => c.name === name) || matchedCustomers[0];
    })
  );
  
  // Create a mapping of customer names to customer data
  const customerMap = customers.reduce<Record<string, any>>((map, customer) => {
    if (customer) {
      map[customer.name] = customer;
    }
    return map;
  }, {});
  
  // Prepare the response with delay information
  return delayedOrders.map(order => {
    const customer = customerMap[order.customerName];
    // Calculate delay in days, ensuring null check for estimatedShippingDate
    const delayInDays = order.estimatedShippingDate 
      ? Math.floor((new Date().getTime() - new Date(order.estimatedShippingDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      orderDate: order.orderDate,
      estimatedShippingDate: order.estimatedShippingDate,
      status: order.status,
      delayInDays: delayInDays,
      contactInfo: customer ? {
        email: customer.email,
        phone: customer.phone,
        contactPerson: customer.contactPerson
      } : null
    };
  });
}

// Endpoint to get orders with shipping delays
router.get('/shipping-delays', isAuthenticated, async (req, res) => {
  try {
    const delayReport = await getShippingDelaysData();
    return res.json(delayReport);
  } catch (error) {
    console.error('Error fetching shipping delays:', error);
    return res.status(500).json({ error: 'Failed to fetch shipping delays' });
  }
});

// PDF generation endpoint for shipping delays
router.get('/shipping-delays/pdf', isAuthenticated, async (req, res) => {
  try {
    const delayReport = await getShippingDelaysData();
    
    // Create PDF document
    const doc = createPdf();
    
    // Add title and metadata
    doc.info.Title = 'Shipping Delays Report';
    doc.info.Author = 'Warehouse Management System';
    
    // Add report title and warning icon
    doc.fontSize(25).text('Shipping Delays Report', { align: 'center' });
    doc.moveDown(0.5);
    
    // Add generated date
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' });
    doc.moveDown(0.5);
    
    // Add summary
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Delayed Orders: ${delayReport.length}`);
    
    if (delayReport.length > 0) {
      const averageDelay = delayReport.reduce((sum, order) => sum + order.delayInDays, 0) / delayReport.length;
      doc.text(`Average Delay: ${averageDelay.toFixed(1)} days`);
      
      // Find the most delayed order
      const mostDelayed = delayReport.reduce((prev, current) => 
        (prev.delayInDays > current.delayInDays) ? prev : current
      );
      doc.text(`Longest Delay: ${mostDelayed.delayInDays} days (Order ${mostDelayed.orderNumber})`);
    }
    
    doc.moveDown(1.5);
    
    // Define table headers and data
    const headers = [
      'Order #', 
      'Customer', 
      'Order Date', 
      'Est. Ship Date', 
      'Delay (days)', 
      'Status'
    ];
    
    const data = delayReport.map(order => [
      order.orderNumber,
      order.customerName,
      formatDate(order.orderDate),
      formatDate(order.estimatedShippingDate),
      order.delayInDays.toString(),
      order.status
    ]);
    
    // Set column widths (total width is ~ 500)
    const columnWidths = [70, 150, 80, 80, 60, 70];
    
    // Draw the table
    drawTable(doc, headers, data, doc.y, { columnWidths });
    
    // Add contact information section if there are delayed orders
    if (delayReport.length > 0) {
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('Contact Information for Delayed Orders');
      doc.moveDown(1);
      
      delayReport.forEach((order, index) => {
        doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${order.orderNumber} - ${order.customerName}`);
        doc.fontSize(10).font('Helvetica');
        
        if (order.contactInfo && (order.contactInfo.email || order.contactInfo.phone || order.contactInfo.contactPerson)) {
          if (order.contactInfo.contactPerson) {
            doc.text(`Contact: ${order.contactInfo.contactPerson}`);
          }
          if (order.contactInfo.phone) {
            doc.text(`Phone: ${order.contactInfo.phone}`);
          }
          if (order.contactInfo.email) {
            doc.text(`Email: ${order.contactInfo.email}`);
          }
        } else {
          doc.text('No contact information available');
        }
        
        doc.text(`Delay: ${order.delayInDays} days`);
        doc.moveDown(0.5);
      });
    }
    
    // Finalize the PDF and send it to the client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=shipping-delays-${new Date().toISOString().split('T')[0]}.pdf`);
    
    doc.pipe(res);
    doc.end();
    
  } catch (error) {
    console.error('Error generating shipping delays PDF:', error);
    return res.status(500).json({ error: 'Failed to generate shipping delays PDF' });
  }
});

// Helper function to calculate order fulfillment statistics
async function getFulfillmentStats(days: number) {
  // Get all orders
  const orders = await storage.getAllOrders();
  
  // Calculate the date for N days ago
  const dateNDaysAgo = new Date();
  dateNDaysAgo.setDate(dateNDaysAgo.getDate() - days);
  
  // Filter orders created within the specified period
  const periodOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    return orderDate >= dateNDaysAgo;
  });
  
  // Calculate statistics
  const totalOrders = periodOrders.length;
  const shippedOrders = periodOrders.filter(order => order.status === 'shipped').length;
  const pendingOrders = periodOrders.filter(order => order.status === 'pending').length;
  const pickedOrders = periodOrders.filter(order => order.status === 'picked').length;
  const cancelledOrders = periodOrders.filter(order => order.status === 'cancelled').length;
  const partialFulfillment = periodOrders.filter(order => order.isPartialFulfillment).length;
  
  // Calculate average fulfillment time (order to shipping)
  let totalFulfillmentDays = 0;
  let ordersWithFulfillmentTime = 0;
  
  // Store orders with fulfillment times for the detailed report
  const orderFulfillmentTimes: Array<{
    orderNumber: string;
    customerName: string;
    orderDate: Date;
    shippingDate: Date | null;
    fulfillmentDays: number;
    onTime: boolean;
  }> = [];
  
  periodOrders.forEach(order => {
    if (order.status === 'shipped' && order.actualShippingDate) {
      const orderDate = new Date(order.orderDate);
      const shippingDate = new Date(order.actualShippingDate);
      const diffTime = Math.abs(shippingDate.getTime() - orderDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      totalFulfillmentDays += diffDays;
      ordersWithFulfillmentTime++;
      
      // Check if it was on time
      let onTime = false;
      if (order.estimatedShippingDate) {
        const estimatedDate = new Date(order.estimatedShippingDate);
        onTime = shippingDate <= estimatedDate;
      }
      
      // Add to detailed list
      orderFulfillmentTimes.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: orderDate,
        shippingDate: shippingDate,
        fulfillmentDays: diffDays,
        onTime: onTime
      });
    }
  });
  
  // Sort by fulfillment time (longest first)
  orderFulfillmentTimes.sort((a, b) => b.fulfillmentDays - a.fulfillmentDays);
  
  const avgFulfillmentTime = ordersWithFulfillmentTime > 0 
    ? (totalFulfillmentDays / ordersWithFulfillmentTime).toFixed(1) 
    : 'N/A';
  
  // Calculate on-time delivery percentage
  let onTimeDeliveries = 0;
  let ordersWithBothDates = 0;
  
  periodOrders.forEach(order => {
    if (order.status === 'shipped' && order.estimatedShippingDate && order.actualShippingDate) {
      ordersWithBothDates++;
      
      const estimatedDate = new Date(order.estimatedShippingDate);
      const actualDate = new Date(order.actualShippingDate);
      
      // Consider delivered on time if actual shipping date is on or before estimated date
      if (actualDate <= estimatedDate) {
        onTimeDeliveries++;
      }
    }
  });
  
  const onTimePercentage = ordersWithBothDates > 0 
    ? ((onTimeDeliveries / ordersWithBothDates) * 100).toFixed(1) 
    : 'N/A';
  
  // Prepare the stats
  return {
    period: `Last ${days} days`,
    totalOrders,
    shippedOrders,
    pendingOrders,
    pickedOrders,
    cancelledOrders,
    partialFulfillment,
    fulfillmentRate: totalOrders > 0 ? ((shippedOrders / totalOrders) * 100).toFixed(1) + '%' : '0%',
    avgFulfillmentTime: avgFulfillmentTime + (avgFulfillmentTime !== 'N/A' ? ' days' : ''),
    onTimeDeliveryRate: onTimePercentage + (onTimePercentage !== 'N/A' ? '%' : ''),
    orderFulfillmentTimes
  };
}

// Endpoint to get order fulfillment statistics 
router.get('/fulfillment-stats', isAuthenticated, async (req, res) => {
  try {
    // Get time period parameter (default to 30 days)
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    const stats = await getFulfillmentStats(days);
    
    // Remove detailed order list from API response to keep it light
    const { orderFulfillmentTimes, ...fulfillmentStats } = stats;
    
    return res.json(fulfillmentStats);
  } catch (error) {
    console.error('Error calculating fulfillment statistics:', error);
    return res.status(500).json({ error: 'Failed to calculate fulfillment statistics' });
  }
});

// PDF generation endpoint for fulfillment statistics
router.get('/fulfillment-stats/pdf', isAuthenticated, async (req, res) => {
  try {
    // Get time period parameter (default to 30 days)
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    const stats = await getFulfillmentStats(days);
    
    // Create PDF document
    const doc = createPdf();
    
    // Add title and metadata
    doc.info.Title = 'Order Fulfillment Statistics Report';
    doc.info.Author = 'Warehouse Management System';
    
    // Add report title
    doc.text('Order Fulfillment Statistics Report', { align: 'center' });
    doc.moveDown(0.5);
    
    // Add period and generated date
    doc.fontSize(12).text(`Period: ${stats.period}`);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' });
    doc.moveDown(1);
    
    // Add summary statistics section
    doc.fontSize(16).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    
    // Create a statistics table
    const statsTable = [
      ['Total Orders', stats.totalOrders.toString()],
      ['Shipped Orders', stats.shippedOrders.toString()],
      ['Pending Orders', stats.pendingOrders.toString()],
      ['Picked Orders', stats.pickedOrders.toString()],
      ['Cancelled Orders', stats.cancelledOrders.toString()],
      ['Partial Fulfillment', stats.partialFulfillment.toString()],
      ['Fulfillment Rate', stats.fulfillmentRate],
      ['Avg. Fulfillment Time', stats.avgFulfillmentTime],
      ['On-Time Delivery Rate', stats.onTimeDeliveryRate]
    ];
    
    // Draw stats table with larger column width for label
    drawTable(doc, ['Metric', 'Value'], statsTable, doc.y, { columnWidths: [250, 250] });
    doc.moveDown(1.5);
    
    // Add detailed order fulfillment section if there are fulfilled orders
    if (stats.orderFulfillmentTimes.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Detailed Order Fulfillment Times');
      doc.moveDown(0.5);
      
      // Create table headers and data
      const headers = [
        'Order #', 
        'Customer', 
        'Order Date', 
        'Ship Date',
        'Days to Ship',
        'On Time'
      ];
      
      const data = stats.orderFulfillmentTimes.map(order => [
        order.orderNumber,
        order.customerName,
        formatDate(order.orderDate),
        formatDate(order.shippingDate),
        order.fulfillmentDays.toString(),
        order.onTime ? 'Yes' : 'No'
      ]);
      
      // Set column widths
      const columnWidths = [70, 150, 80, 80, 60, 50];
      
      // Draw the table
      drawTable(doc, headers, data, doc.y, { columnWidths });
    }
    
    // Finalize the PDF and send it to the client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fulfillment-stats-${new Date().toISOString().split('T')[0]}.pdf`);
    
    doc.pipe(res);
    doc.end();
    
  } catch (error) {
    console.error('Error generating fulfillment statistics PDF:', error);
    return res.status(500).json({ error: 'Failed to generate fulfillment statistics PDF' });
  }
});

export default router;