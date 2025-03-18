declare module 'react-barcode-reader' {
  import * as React from 'react';

  interface BarcodeReaderProps {
    onError?: (error: any) => void;
    onScan: (data: string) => void;
    minLength?: number;
    delay?: number;
    stopPropagation?: boolean;
    preventDefault?: boolean;
  }

  export default class BarcodeReader extends React.Component<BarcodeReaderProps> {}
}