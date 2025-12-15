import { CreateCarCommandPayload } from '../../types/car.js'

export class CreateCarCommand {
  public readonly ownerID: string
  public readonly vin: string
  public readonly registrationNumber: string
  public readonly mileage: number

  constructor(public readonly payload: CreateCarCommandPayload) {
    this.ownerID = payload.ownerID
    this.vin = payload.vin
    this.registrationNumber = payload.registrationNumber
    this.mileage = payload.mileage
  }
}
