import { RecordCarMileageCommandPayload } from '../../types/car.js'

export class RecordCarMileageCommand {
  public readonly id: string
  public readonly mileage: number

  constructor(public readonly payload: RecordCarMileageCommandPayload) {
    this.id = payload.id
    this.mileage = payload.mileage
  }
}
