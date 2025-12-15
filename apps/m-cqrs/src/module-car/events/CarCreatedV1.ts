import { CarCreatedV1EventPayload } from '../../types/car.js'
import { CarCreated } from './CarCreated.js'

export class CarCreatedV1 extends CarCreated {
  public id: string

  public ownerID: string
  public vin: string
  public registrationNumber: string
  public mileage: number

  public version: number = 1

  constructor(payload: CarCreatedV1EventPayload) {
    super(payload)

    this.id = payload.id
    this.ownerID = payload.ownerID
    this.vin = payload.vin
    this.registrationNumber = payload.registrationNumber
    this.mileage = payload.mileage
  }

  toJson() {
    return {
      id: this.id,
      ownerID: this.ownerID,
      vin: this.vin,
      registrationNumber: this.registrationNumber,
      mileage: this.mileage
    }
  }
}
