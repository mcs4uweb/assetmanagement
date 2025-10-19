// src/models/Vehicle.ts
export interface Vehicle {
  key?: string
  UserId?: string
  make?: string
  model?: string
  year?: number
  color?: string
  vin?: string
  plate?: string
  tires?: string
  tireSize?: string
  tirePressure?: string
  oilType?: string
  purchaseDate?: Date
  parcelNumber?: string
  category?: string
  description?: string
  videos?: Video[]
  odometer?: Odometer[]
  oilChange?: OilChange[]
  partNumber?: Part[]
  tools?: Tool[]
  maintenance?: Maintenance[]
}

export interface Video {
  name?: string
  url?: string
}

export interface Odometer {
  odometer?: number
  type?: string
  date?: Date
  reading?: Date
}

export interface OilChange {
  date?: Date | string
  odometer?: number
}

export interface Part {
  part?: string
  type?: string
  url?: string
  date?: Date | string
  description?: string
}

export interface Tool {
  name?: string
  description?: string
}

export interface Maintenance {
  maintenanceType?: string
  maintenanceEndDate?: Date | string
  maintenanceDesc?: string
}
