import { useState, useCallback } from 'react';
import { ENV } from '../../../config/env';

export interface PaystackPayArgs {
  publicKey?: string;
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
}

export function usePaystackInline() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<PaystackPayArgs | null>(null);

  const startPayment = useCallback((args: PaystackPayArgs) => {
    setCurrentConfig({
      ...args,
      publicKey: args.publicKey || ENV.PAYSTACK_PUBLIC_KEY,
    });
    setIsOpen(true);
  }, []);

  const closePayment = useCallback(() => {
    setIsOpen(false);
    setCurrentConfig(null);
  }, []);

  return {
    isOpen,
    currentConfig,
    startPayment,
    closePayment,
  };
}
