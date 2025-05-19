import { Request, Response } from 'express';
import { storage } from '../storage';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { format } from 'date-fns';
import { ShippingItinerary } from '@shared/schema.itineraries';

/**
 * Generate a printable itinerary that includes:
 * - All orders in the itinerary
 * - Box count for each order
 * - Shipping company preferences for each customer
 */
export async function generateItineraryPdf(req: Request, res: Response) {
  try {
    const itineraryId = parseInt(req.params.id);
    if (isNaN(itineraryId)) {
      return res.status(400).json({ error: 'Invalid itinerary ID' });
    }

    // Get the itinerary details
    const itinerary = await storage.getShippingItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Shipping itinerary not found' });
    }

    // Get all orders associated with this itinerary
    const orders = await storage.getOrdersForItinerary(itineraryId);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'No orders found in this itinerary' });
    }

    // Fetch customer details for these orders
    const orderDetails = await Promise.all(
      orders.map(async (order) => {
        // Get customer details for the order
        const customer = await storage.getCustomerByName(order.customerName);
        return {
          ...order,
          customer,
          boxCount: order.boxCount || 1, // Use the stored box count or default to 1
          preferredShippingCompany: customer?.preferredShippingCompany || 'Not specified'
        };
      })
    );

    // Create a new PDF document
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      info: {
        Title: `Delivery Itinerary #${itinerary.itineraryNumber}`,
        Author: 'Warehouse Management System',
        Subject: `Delivery Itinerary for ${format(new Date(itinerary.departureDate), 'dd/MM/yyyy')}`
      }
    });

    // Set the filename for download
    const filename = `itinerary-${itinerary.itineraryNumber}-${format(new Date(), 'yyyyMMdd')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add the company logo if available
    try {
      const logoPath = path.join(process.cwd(), 'public', 'shipping-logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 100 });
      }
    } catch (err) {
      console.error('Logo image not found:', err);
    }

    // Add title and itinerary details
    doc.fontSize(20).text('ΔΡΟΜΟΛΟΓΙΟ ΠΑΡΑΔΟΣΗΣ', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Αριθμός Δρομολογίου: ${itinerary.itineraryNumber}`, { align: 'left' });
    doc.text(`Ημερομηνία Αναχώρησης: ${format(new Date(itinerary.departureDate), 'dd/MM/yyyy HH:mm')}`, { align: 'left' });
    
    if (itinerary.driverName) {
      doc.text(`Οδηγός: ${itinerary.driverName}`, { align: 'left' });
    }
    
    if (itinerary.vehicleInfo) {
      doc.text(`Όχημα: ${itinerary.vehicleInfo}`, { align: 'left' });
    }
    
    if (itinerary.shippingCompany) {
      doc.text(`Εταιρεία Μεταφοράς: ${itinerary.shippingCompany}`, { align: 'left' });
    }
    
    doc.text(`Συνολικά Κιβώτια: ${itinerary.totalBoxes}`, { align: 'left' });
    doc.moveDown();

    // Add orders table header
    doc.moveDown();
    doc.fontSize(14).text('Παραγγελίες', { align: 'left' });
    doc.moveDown(0.5);

    // Define table columns
    const tableTop = doc.y;
    const tableHeaders = ['Αρ. Παραγγελίας', 'Πελάτης', 'Κιβώτια', 'Μεταφορική'];
    const columnWidth = (doc.page.width - 100) / tableHeaders.length;

    // Draw the table header
    doc.fontSize(10).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, 50 + (i * columnWidth), tableTop, { width: columnWidth, align: 'left' });
    });
    doc.moveDown();

    // Draw a line below the header
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);

    // Draw table rows for each order
    doc.font('Helvetica');
    let currentY = doc.y;
    let totalBoxCount = 0;

    orderDetails.forEach((order, index) => {
      // Check if we need a new page
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        currentY = 50;
        
        // Re-add the table header on the new page
        doc.fontSize(10).font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
          doc.text(header, 50 + (i * columnWidth), currentY, { width: columnWidth, align: 'left' });
        });
        doc.moveDown();
        
        // Draw a line below the header
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.5);
        currentY = doc.y;
        doc.font('Helvetica');
      }

      // Add the order details to the table
      doc.text(order.orderNumber, 50, currentY, { width: columnWidth, align: 'left' });
      doc.text(order.customerName, 50 + columnWidth, currentY, { width: columnWidth, align: 'left' });
      doc.text(order.boxCount.toString(), 50 + (2 * columnWidth), currentY, { width: columnWidth, align: 'left' });
      
      // Display shipping company preference
      let shippingCompany = 'Δεν έχει οριστεί';
      if (order.customer?.preferredShippingCompany) {
        shippingCompany = order.customer.preferredShippingCompany;
      } else if (order.customer?.customShippingCompany) {
        shippingCompany = order.customer.customShippingCompany;
      }
      doc.text(shippingCompany, 50 + (3 * columnWidth), currentY, { width: columnWidth, align: 'left' });
      
      // Move to the next row
      doc.moveDown();
      currentY = doc.y;
      
      // Add to total box count
      totalBoxCount += order.boxCount;
    });

    // Draw a line below the table
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);

    // Add totals at the bottom
    doc.font('Helvetica-Bold').text(`Συνολικές Παραγγελίες: ${orderDetails.length}`, 50, doc.y);
    doc.text(`Συνολικά Κιβώτια: ${totalBoxCount}`, 50, doc.y + 20);

    // Add space for signatures
    doc.moveDown(2);
    doc.fontSize(12).text('Υπογραφή Αποθηκάριου: ___________________', 50, doc.y);
    doc.moveDown();
    doc.text('Υπογραφή Οδηγού: _______________________', 50, doc.y);

    // Add notes if available
    if (itinerary.notes) {
      doc.moveDown(2);
      doc.fontSize(10).text('Σημειώσεις:', 50, doc.y);
      doc.font('Helvetica').text(itinerary.notes, 50, doc.y + 15);
    }

    // Add the current date/time at the bottom
    doc.fontSize(8).text(
      `Εκτυπώθηκε: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 
      50, 
      doc.page.height - 50,
      { align: 'center' }
    );

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error('Error generating itinerary PDF:', error);
    return res.status(500).json({ error: 'Failed to generate itinerary PDF' });
  }
}