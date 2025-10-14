// src/contexts/CartContext.tsx
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { CartItem } from '../models/Cart'

interface CartContextType {
  cartItems: CartItem[]
  cartTotal: number
  addToCart: (item: CartItem) => void
  removeFromCart: (productId: string) => void
  updateCart: (item: CartItem) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const useCart = () => {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  useEffect(() => {
    const savedCart = localStorage.getItem('cartItems')
    if (savedCart) {
      setCartItems(JSON.parse(savedCart))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems))
  }, [cartItems])

  const addToCart = (item: CartItem) => {
    setCartItems(prev => {
      const existingItem = prev.find(i => i.Product_id === item.Product_id)
      if (existingItem) {
        return prev.map(i =>
          i.Product_id === item.Product_id
            ? { ...i, Count: i.Count + 1, TotalPrice: parseFloat(i.UnitPrice) * (i.Count + 1) }
            : i
        )
      }
      return [...prev, { ...item, TotalPrice: parseFloat(item.UnitPrice) * item.Count }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.Product_id !== productId))
  }

  const updateCart = (updatedItem: CartItem) => {
    setCartItems(prev =>
      prev.map(item =>
        item.Product_id === updatedItem.Product_id ? updatedItem : item
      )
    )
  }

  const clearCart = () => {
    setCartItems([])
  }

  const cartTotal = cartItems.reduce((total, item) => total + item.Count, 0)

  const value = {
    cartItems,
    cartTotal,
    addToCart,
    removeFromCart,
    updateCart,
    clearCart
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}