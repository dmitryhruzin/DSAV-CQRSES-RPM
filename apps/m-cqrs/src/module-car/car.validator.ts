export default class CarValidator {
  static isValidMileage(mileage: number): boolean {
    return typeof mileage === 'number' && mileage >= 0
  }
  static isValidVin(vin: string): boolean {
    return typeof vin === 'string' && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)
  }
  static isValidRegistrationNumber(registrationNumber: string): boolean {
    // Ukrainian car number: 2 letters, 4 digits, 2 letters (e.g. AE1111OB)
    return typeof registrationNumber === 'string' && /^[A-Z]{2}\d{4}[A-Z]{2}$/.test(registrationNumber)
  }
}
