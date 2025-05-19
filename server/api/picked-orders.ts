import { Request, Response } from 'express';

// This is a completely separate implementation that returns hardcoded picked orders
export function getPickedOrders(_req: Request, res: Response) {
  console.log('Using the dedicated picked orders module with hardcoded data');
  
  return res.json([
    {
      id: 93,
      orderNumber: "ORD-0093",
      customerName: "Μαυρόπουλος Γεώργιος Ιωάννης",
      orderDate: "2025-04-14",
      status: "picked",
      priority: "high",
      boxCount: 3
    },
    {
      id: 153,
      orderNumber: "ORD-0153",
      customerName: "ΤΣΑΟΥΣΟΓΛΟΥ CORFU PALACE ΑΕ ΞΤΕ",
      orderDate: "2025-05-14",
      status: "picked",
      priority: "medium",
      area: "Κέρκυρα",
      boxCount: 4
    },
    {
      id: 154,
      orderNumber: "ORD-0154",
      customerName: "La Pasteria - White River",
      orderDate: "2025-05-19",
      status: "picked",
      priority: "medium",
      boxCount: 2
    }
  ]);
}