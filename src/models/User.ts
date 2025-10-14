// src/models/User.ts
export interface User {
  UserId: string
  Email: string
  DisplayName: string
  PhotoURL: string
  Phone?: string
  Address?: string
  City?: string
  State?: string
  Zip?: string
}