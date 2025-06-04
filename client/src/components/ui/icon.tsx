import React from 'react';
import { FontAwesomeIcon, FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/lib/utils';

interface IconProps extends Omit<FontAwesomeIconProps, 'icon' | 'size'> {
  icon: IconDefinition;
  className?: string;
  size?: FontAwesomeIconProps['size'];
}

/**
 * Optimized Icon component using FontAwesome React with tree-shaking
 * Replaces global CSS imports for better bundle size
 */
export function Icon({ icon, className, size, ...props }: IconProps) {
  return (
    <FontAwesomeIcon
      icon={icon}
      className={cn(className)}
      size={size}
      {...props}
    />
  );
}

// Convenience wrapper for commonly used patterns
export function ActionIcon({ 
  icon, 
  onClick, 
  className,
  disabled = false,
  ...props 
}: IconProps & {
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center p-1 rounded hover:bg-gray-100 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      type="button"
      {...(disabled && { tabIndex: -1 })}
    >
      <Icon icon={icon} {...props} />
    </button>
  );
}

export default Icon;