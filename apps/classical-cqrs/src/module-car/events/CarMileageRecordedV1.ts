import { CarMileageRecordedV1EventPayload } from '../../types/car.js'
import { CarMileageRecorded } from './CarMileageRecorded.js'

export class CarMileageRecordedV1 extends CarMileageRecorded {
  public mileage: number
  public previousMileage: number
  public version: number = 1

  constructor(payload: CarMileageRecordedV1EventPayload) {
    super(payload)

    this.mileage = payload.mileage
    this.previousMileage = payload.previousMileage
  }

  toJson() {
    return {
      previousMileage: this.previousMileage,
      mileage: this.mileage
    }
  }
}
