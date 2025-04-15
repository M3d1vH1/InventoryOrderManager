import React, { useState } from 'react';
import { Box } from 'lucide-react';

interface ProductImageProps {
  imagePath?: string | null;
  productName: string;
  className?: string;
}

/**
 * A consistent component for displaying product images with built-in error handling
 * and fallback display when images are unavailable
 */
export function ProductImage({ imagePath, productName, className = '' }: ProductImageProps) {
  const [imageError, setImageError] = useState(false);
  
  // Show placeholder if no image path or if there was an error loading the image
  if (!imagePath || imageError) {
    return (
      <div className={`flex items-center justify-center h-full bg-muted/30 ${className}`}>
        <Box className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }
  
  // Handle path formatting to ensure consistency
  const formattedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return (
    <img
      src={formattedPath}
      alt={productName}
      className={`object-cover ${className}`}
      onError={(e) => {
        // Silently handle the error without logging to console
        const img = e.target as HTMLImageElement;
        img.src = '/placeholder-image.svg';
        
        // If the placeholder also fails, show the Box icon
        img.onerror = () => {
          setImageError(true);
        };
      }}
    />
  );
}