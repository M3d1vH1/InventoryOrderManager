import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a JavaScript object array to CSV string
 * @param data Array of objects to be converted to CSV
 * @returns CSV string
 */
export function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  // Get headers from the first item
  const headers = Object.keys(data[0]);
  
  // Create CSV header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return headers.map(header => {
      // Handle values that might contain commas or quotes
      const value = item[header];
      const valueStr = value === null || value === undefined ? '' : String(value);
      
      // If the value contains commas, newlines, or quotes, enclose in quotes
      if (valueStr.includes(',') || valueStr.includes('\n') || valueStr.includes('"')) {
        return `"${valueStr.replace(/"/g, '""')}"`;
      }
      return valueStr;
    }).join(',');
  });
  
  // Combine header row and data rows
  return [headerRow, ...rows].join('\n');
}

/**
 * Converts data to simple HTML for PDF generation
 * @param data Array of objects to be converted to HTML table
 * @param title Title of the document
 * @returns HTML string
 */
export function convertToHTML(data: any[], title: string): string {
  if (data.length === 0) return '<html><body><h1>No data available</h1></body></html>';
  
  // Get headers from the first item
  const headers = Object.keys(data[0]);
  
  // Create table header row
  const headerRow = headers.map(header => `<th>${header}</th>`).join('');
  
  // Create table data rows
  const rows = data.map(item => {
    const cells = headers.map(header => {
      const value = item[header];
      return `<td>${value === null || value === undefined ? '' : String(value)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  
  // Create HTML document with table
  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>${headerRow}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Converts a JavaScript object array to Excel XML format
 * @param data Array of objects to be converted to Excel
 * @param sheetName Name of the Excel sheet
 * @returns Excel XML string
 */
export function convertToExcel(data: any[], sheetName: string): string {
  if (data.length === 0) return '';
  
  // Get headers from the first item
  const headers = Object.keys(data[0]);
  
  // Create Excel XML header
  let excelXml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
  excelXml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
  excelXml += 'xmlns:o="urn:schemas-microsoft-com:office:office" ';
  excelXml += 'xmlns:x="urn:schemas-microsoft-com:office:excel" ';
  excelXml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  excelXml += '<Worksheet ss:Name="' + sheetName + '">';
  excelXml += '<Table>';
  
  // Add header row
  excelXml += '<Row>';
  headers.forEach(header => {
    excelXml += '<Cell><Data ss:Type="String">' + header + '</Data></Cell>';
  });
  excelXml += '</Row>';
  
  // Add data rows
  data.forEach(item => {
    excelXml += '<Row>';
    headers.forEach(header => {
      const value = item[header];
      if (value === null || value === undefined) {
        excelXml += '<Cell><Data ss:Type="String"></Data></Cell>';
      } else if (typeof value === 'number') {
        excelXml += '<Cell><Data ss:Type="Number">' + value + '</Data></Cell>';
      } else if (typeof value === 'boolean') {
        excelXml += '<Cell><Data ss:Type="Boolean">' + value + '</Data></Cell>';
      } else {
        // Escape XML special characters
        const escapedValue = String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        excelXml += '<Cell><Data ss:Type="String">' + escapedValue + '</Data></Cell>';
      }
    });
    excelXml += '</Row>';
  });
  
  // Close Excel XML
  excelXml += '</Table>';
  excelXml += '</Worksheet>';
  excelXml += '</Workbook>';
  
  return excelXml;
}

/**
 * Downloads data as a file
 * @param content The content to be downloaded
 * @param fileName The name of the file to be downloaded
 * @param contentType The MIME type of the file
 */
export function downloadFile(content: string, fileName: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Formats a date for use in filenames
 * @returns Formatted date string (YYYY-MM-DD)
 */
export function formatDateForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Export data based on selected format
 * @param data The data to export
 * @param format The export format ('csv', 'excel', or 'pdf')
 * @param title The title/name for the export
 */
export function exportData(data: any[], format: string, title: string): void {
  const dateStr = formatDateForFilename();
  const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  switch (format.toLowerCase()) {
    case 'csv':
      const csvContent = convertToCSV(data);
      downloadFile(csvContent, `${safeTitle}_${dateStr}.csv`, 'text/csv');
      break;
      
    case 'excel':
      const excelContent = convertToExcel(data, title);
      downloadFile(excelContent, `${safeTitle}_${dateStr}.xls`, 'application/vnd.ms-excel');
      break;
      
    case 'pdf':
      const htmlContent = convertToHTML(data, title);
      // For PDF, we'll use print-to-PDF functionality since true PDF generation would require additional libraries
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      break;
      
    default:
      console.error('Unsupported export format:', format);
  }
}
