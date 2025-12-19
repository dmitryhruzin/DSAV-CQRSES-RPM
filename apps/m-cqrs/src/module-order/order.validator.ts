export default class OrderValidator {
  static isValidTitle(title: string): boolean {
    return typeof title === 'string' && title.trim() !== '' && title === title.trim()
  }
  static isValidPrice(price: string): boolean {
    return typeof price === 'string' && /^[0-9]+\.[0-9]{2}$/.test(price)
  }
  static isValidPriority(priority: number): boolean {
    return Number.isInteger(priority) && priority >= 1 && priority <= 5
  }
}
