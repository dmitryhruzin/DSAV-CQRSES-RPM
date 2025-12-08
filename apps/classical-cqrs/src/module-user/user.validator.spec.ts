import UserValidator from './user.validator'

describe('UserValidator', () => {
  describe('isValidPassword', () => {
    const cases = [
      { input: 'password', expected: true },
      { input: '12345678', expected: true },
      { input: 'abcdefgh', expected: true },
      { input: 'short', expected: false },
      { input: '1234567', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 12345678, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(UserValidator.isValidPassword(input)).toBe(expected)
    })
  })
})
