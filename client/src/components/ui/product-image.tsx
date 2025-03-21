import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export function ProductImage({
  src,
  alt = 'Product image',
  className,
  fallbackSrc = '/placeholder-image.svg',
  ...props
}: ProductImageProps) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
  };

  return (
    <img
      src={imgSrc || fallbackSrc}
      alt={alt}
      className={cn('object-contain', className)}
      onError={handleError}
      {...props}
    />
  );
}