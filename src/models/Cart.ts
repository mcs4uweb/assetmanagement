// src/models/Cart.ts
export interface CartItem {
  Product_id: string
  Name: string
  Description: string
  Thumb: string
  Count: number
  UnitPrice: string
  TotalPrice: number
  key?: string
}