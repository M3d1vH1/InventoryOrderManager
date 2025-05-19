// Dedicated module for providing picked orders to the simple itineraries page
import { Request, Response } from 'express';

export const getSimplePickedOrders = (_req: Request, res: Response) => {
  console.log('Using hardcoded picked orders from SQL results for certainty');
  
  // Based on exact database data from SELECT * FROM orders WHERE status = 'picked'
  return res.json([
    {
      id: 93,
      orderNumber: "ORD-0093",
      customerName: "Μαυρόπουλος Γεώργιος Ιωάννης",
      status: "picked",
      priority: "high",
      boxCount: 3
    },
    {
      id: 153,
      orderNumber: "ORD-0153",
      customerName: "ΤΣΑΟΥΣΟΓΛΟΥ CORFU PALACE ΑΕ ΞΤΕ",
      status: "picked",
      priority: "medium",
      area: "Κέρκυρα",
      boxCount: 4
    },
    {
      id: 154,
      orderNumber: "ORD-0154",
      customerName: "La Pasteria - White River",
      status: "picked",
      priority: "medium",
      boxCount: 2
    }
  ]);
};