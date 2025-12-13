import CustomerValidator from './customer.validator'

describe('CustomerValidator', () => {
  describe('isValidEmail', () => {
    const cases = [
      { input: 'test@example.com', expected: true },
      { input: 'user.name+tag+sorting@example.com', expected: true },
      { input: 'user@sub.example.co.uk', expected: true },
      { input: 'invalid-email', expected: false },
      { input: 'user@', expected: false },
      { input: '@example.com', expected: false },
      { input: 'user@.com', expected: false },
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 12345678, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(CustomerValidator.isValidEmail(input)).toBe(expected)
    })
  })

  describe('isValidPhoneNumber', () => {
    const cases = [
      { input: '+1234567890', expected: true },
      { input: '1234567890', expected: true },
      { input: '0123456789', expected: true },
      { input: '+123456789', expected: false }, // 9 digits
      { input: '123456789', expected: false }, // 9 digits
      { input: '12345', expected: false },
      { input: 'abcdefghij', expected: false },
      { input: '+12345abcde', expected: false },
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 1234567890, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(CustomerValidator.isValidPhoneNumber(input)).toBe(expected)
    })
  })
})
