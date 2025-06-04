/**
 * Centralized Icon Library
 * Tree-shakable FontAwesome icons for optimal bundle size
 */

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  // Navigation & UI
  faHome,
  faCog,
  faUser,
  faUsers,
  faBars,
  faSearch,
  faPlus,
  faMinus,
  faEdit,
  faTrash,
  faSave,
  faCheck,
  faTimes,
  faArrowLeft,
  faArrowRight,
  faChevronDown,
  faChevronUp,
  faChevronLeft,
  faChevronRight,
  
  // Business & Commerce
  faShoppingCart,
  faBoxes,
  faWarehouse,
  faTruck,
  faClipboardList,
  faBarcode,
  faCalculator,
  faDollarSign,
  faCreditCard,
  faReceipt,
  
  // Communication
  faEnvelope,
  faPhone,
  faBell,
  faComment,
  faComments,
  
  // Files & Documents
  faFile,
  faFileText,
  faFilePdf,
  faFileExcel,
  faDownload,
  faUpload,
  faPrint,
  
  // Status & Alerts
  faExclamationTriangle,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  
  // Data & Analytics
  faChartBar,
  faChartLine,
  faTable,
  faDatabase,
  faFilter,
  faSortUp,
  faSortDown,
  
  // System & Settings
  faWrench,
  faTools,
  faSync,
  faPowerOff,
  faLock,
  faUnlock,
  faEye,
  faEyeSlash,
  
  // Time & Calendar
  faClock,
  faCalendar,
  faCalendarAlt,
  
  // Additional Business Icons
  faIndustry,
  faHardHat,
  faClipboard,
  faTags,
  faTag
} from '@fortawesome/free-solid-svg-icons';

import {
  // Regular (outline) icons
  faHeart as farHeart,
  faStar as farStar,
  faComment as farComment,
  faEnvelope as farEnvelope,
  faUser as farUser,
  faFile as farFile,
  faCalendar as farCalendar,
  faCheckCircle as farCheckCircle,
  faTimesCircle as farTimesCircle
} from '@fortawesome/free-regular-svg-icons';

import {
  // Brand icons
  faGithub,
  faTwitter,
  faFacebook,
  faLinkedin,
  faGoogle,
  faSlack,
  faMicrosoft
} from '@fortawesome/free-brands-svg-icons';

// Add all icons to the library for global access
library.add(
  // Solid icons
  faHome, faCog, faUser, faUsers, faBars, faSearch, faPlus, faMinus,
  faEdit, faTrash, faSave, faCheck, faTimes, faArrowLeft, faArrowRight,
  faChevronDown, faChevronUp, faChevronLeft, faChevronRight,
  faShoppingCart, faBoxes, faWarehouse, faTruck, faClipboardList,
  faBarcode, faCalculator, faDollarSign, faCreditCard, faReceipt,
  faEnvelope, faPhone, faBell, faComment, faComments,
  faFile, faFileText, faFilePdf, faFileExcel, faDownload, faUpload, faPrint,
  faExclamationTriangle, faInfoCircle, faCheckCircle, faTimesCircle, faSpinner,
  faChartBar, faChartLine, faTable, faDatabase, faFilter, faSortUp, faSortDown,
  faWrench, faTools, faSync, faPowerOff, faLock, faUnlock, faEye, faEyeSlash,
  faClock, faCalendar, faCalendarAlt, faIndustry, faHardHat, faClipboard, faTags, faTag,
  
  // Regular icons
  farHeart, farStar, farComment, farEnvelope, farUser, farFile,
  farCalendar, farCheckCircle, farTimesCircle,
  
  // Brand icons
  faGithub, faTwitter, faFacebook, faLinkedin, faGoogle, faSlack, faMicrosoft
);

// Export commonly used icons for direct import
export {
  // Navigation & UI
  faHome,
  faCog,
  faUser,
  faUsers,
  faBars,
  faSearch,
  faPlus,
  faMinus,
  faEdit,
  faTrash,
  faSave,
  faCheck,
  faTimes,
  
  // Business & Commerce
  faShoppingCart,
  faBoxes,
  faWarehouse,
  faTruck,
  faClipboardList,
  faBarcode,
  
  // Status & Alerts
  faExclamationTriangle,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  
  // Regular icons (with 'far' prefix to avoid conflicts)
  farHeart,
  farStar,
  farUser,
  
  // Brand icons
  faGithub,
  faSlack
};

// Export icon categories for organized usage
export const NavigationIcons = {
  home: faHome,
  user: faUser,
  users: faUsers,
  settings: faCog,
  menu: faBars,
  search: faSearch
};

export const ActionIcons = {
  add: faPlus,
  remove: faMinus,
  edit: faEdit,
  delete: faTrash,
  save: faSave,
  confirm: faCheck,
  cancel: faTimes
};

export const BusinessIcons = {
  cart: faShoppingCart,
  inventory: faBoxes,
  warehouse: faWarehouse,
  shipping: faTruck,
  orders: faClipboardList,
  barcode: faBarcode
};

export const StatusIcons = {
  warning: faExclamationTriangle,
  info: faInfoCircle,
  success: faCheckCircle,
  error: faTimesCircle,
  loading: faSpinner
};

export const BrandIcons = {
  github: faGithub,
  slack: faSlack,
  google: faGoogle
};