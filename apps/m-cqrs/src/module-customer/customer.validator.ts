export default class CustomerValidator {
  static isValidEmail(email: string): boolean {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
  static isValidPhoneNumber(phoneNumber: string): boolean {
    return (
      typeof phoneNumber === 'string' && phoneNumber.replace('+', '').length >= 10 && /^\+?[0-9]+$/.test(phoneNumber)
    )
  }
}
