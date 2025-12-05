export default class UserValidator {
  static isValidPassword(password: string): boolean {
    return typeof password === 'string' && password.length >= 8
  }
}
