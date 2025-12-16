export default class WorkerValidator {
  static isValidHourlyRate(hourlyRate: string): boolean {
    return typeof hourlyRate === 'string' && /^[0-9]+\.[0-9]{2}$/.test(hourlyRate)
  }
  static isValidRole(role: string): boolean {
    return typeof role === 'string' && role.trim() !== '' && role === role.trim()
  }
}
