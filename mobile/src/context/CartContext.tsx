import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LocalStorage } from '../storage/localStorage';

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  originalPrice?: number;
  image?: string;
  quantity: number;
  sellerId: string;
  sellerName?: string;
  stock?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalCount: 0,
  subtotal: 0,
  isLoading: true,
});

export const useCart = () => useContext(CartContext);

const CART_STORAGE_KEY = 'linkup_mobile_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Restore cart from local storage on launch
  useEffect(() => {
    async function loadStoredCart() {
      const stored = await LocalStorage.getItem<CartItem[]>(CART_STORAGE_KEY, []);
      if (stored) {
        setItems(stored);
      }
      setIsLoading(false);
    }
    loadStoredCart();
  }, []);

  // Persist cart whenever it changes
  const saveItems = async (newItems: CartItem[]) => {
    setItems(newItems);
    await LocalStorage.setItem(CART_STORAGE_KEY, newItems);
  };

  const addToCart = (product: Omit<CartItem, 'quantity'>, quantity = 1) => {
    const existingIndex = items.findIndex((i) => i.productId === product.productId);
    let updated: CartItem[];

    if (existingIndex > -1) {
      updated = [...items];
      updated[existingIndex].quantity += quantity;
    } else {
      updated = [...items, { ...product, quantity }];
    }
    saveItems(updated);
  };

  const removeFromCart = (productId: string) => {
    const updated = items.filter((i) => i.productId !== productId);
    saveItems(updated);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const updated = items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
    saveItems(updated);
  };

  const clearCart = () => {
    saveItems([]);
  };

  const totalCount = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const subtotal = items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
