// src/app/cart/page.tsx
'use client'

import Link from 'next/link'
import Layout from '../../components/layout/Layout'
import { useCart } from '../../contexts/CartContext'
import { CartItem } from '../../models/Cart'
import { useMemo } from 'react'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const clampQuantity = (value: number) => Math.max(1, value)

export default function CartPage() {
  const { cartItems, updateCart, removeFromCart, clearCart } = useCart()

  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + (item.TotalPrice || 0), 0),
    [cartItems]
  )

  const handleQuantityChange = (item: CartItem, nextQty: number) => {
    const quantity = clampQuantity(nextQty)
    if (quantity === item.Count) return

    updateCart({
      ...item,
      Count: quantity,
      TotalPrice: parseFloat(item.UnitPrice) * quantity,
    })
  }

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold text-gray-900">Your Cart</h1>

          {cartItems.length === 0 ? (
            <div className="mt-10 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
              <h2 className="text-xl font-medium text-gray-700">Your cart is empty</h2>
              <p className="mt-2 text-gray-500">
                Start adding assets to see them here.
              </p>
              <Link
                href="/home"
                className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                Browse Assets
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[2fr,1fr]">
              <div className="space-y-6">
                {cartItems.map((item) => (
                  <div
                    key={item.Product_id}
                    className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:flex-row"
                  >
                    <div className="flex-shrink-0">
                      <div className="h-24 w-24 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                        {item.Thumb ? (
                          <img
                            src={item.Thumb}
                            alt={item.Name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                            No image
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                              {item.Name}
                            </h2>
                            {item.Description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {item.Description}
                              </p>
                            )}
                          </div>
                          <p className="text-lg font-medium text-gray-900">
                            {currency.format(item.TotalPrice || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item, item.Count - 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-lg text-gray-600 hover:bg-gray-100"
                            aria-label={`Decrease quantity for ${item.Name}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.Count}
                            onChange={(event) => {
                              const parsed = Number(event.target.value)
                              handleQuantityChange(item, Number.isFinite(parsed) ? parsed : 1)
                            }}
                            className="h-9 w-16 rounded border border-gray-300 text-center text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item, item.Count + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-lg text-gray-600 hover:bg-gray-100"
                            aria-label={`Increase quantity for ${item.Name}`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.Product_id)}
                          className="text-sm font-medium text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <aside className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
                  <dl className="mt-4 space-y-3 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <dt>Subtotal</dt>
                      <dd className="font-medium text-gray-900">{currency.format(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Estimated Tax</dt>
                      <dd className="text-gray-500">Calculated at checkout</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Shipping</dt>
                      <dd className="text-gray-500">Free</dd>
                    </div>
                  </dl>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-semibold text-gray-900">
                    <span>Total</span>
                    <span>{currency.format(subtotal)}</span>
                  </div>
                  <button
                    type="button"
                    className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Proceed to Checkout
                  </button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="mt-3 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Clear Cart
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
