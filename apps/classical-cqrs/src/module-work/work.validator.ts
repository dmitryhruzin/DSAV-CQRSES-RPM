export default class WorkValidator {
  static isValidTitle(title: string): boolean {
    return (
      typeof title === 'string' &&
      title.trim() !== '' &&
      title === title.trim() &&
      title.length <= 100 &&
      title.length >= 3
    )
  }
  static isValidDescription(description: string): boolean {
    return (
      typeof description === 'string' &&
      description.trim() !== '' &&
      description === description.trim() &&
      description.length <= 1000 &&
      description.length >= 3
    )
  }
  static isValidEstimate(estimate: string): boolean {
    return (
      typeof estimate === 'string' &&
      estimate.trim() !== '' &&
      estimate === estimate.trim() &&
      /^(?:\d+d(?:\s[1-7]h)?|[1-7]h)$/.test(estimate)
    )
  }
}
