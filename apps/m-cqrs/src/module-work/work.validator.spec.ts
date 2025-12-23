import WorkValidator from './work.validator'

describe('WorkValidator', () => {
  describe('isValidTitle', () => {
    const cases = [
      { input: 'Valid Title', expected: true },
      { input: 'abc', expected: true },
      { input: 'A'.repeat(100), expected: true },
      { input: 'ab', expected: false },
      { input: 'A'.repeat(101), expected: false },
      { input: '', expected: false },
      { input: '   ', expected: false },
      { input: '  Valid Title  ', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(WorkValidator.isValidTitle(input)).toBe(expected)
    })
  })

  describe('isValidDescription', () => {
    const cases = [
      { input: 'Valid description', expected: true },
      { input: 'abc', expected: true },
      { input: 'A'.repeat(1000), expected: true },
      { input: 'ab', expected: false },
      { input: 'A'.repeat(1001), expected: false },
      { input: '', expected: false },
      { input: '   ', expected: false },
      { input: '  Valid description  ', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(WorkValidator.isValidDescription(input)).toBe(expected)
    })
  })

  describe('isValidEstimate', () => {
    const cases = [
      { input: '1d 4h', expected: true },
      { input: '5d', expected: true },
      { input: '4h', expected: true },
      { input: '10d 7h', expected: true },
      { input: '10d 10h', expected: false },
      { input: '0d 0h', expected: false },
      { input: '1d4h', expected: false },
      { input: '1 d 4 h', expected: false },
      { input: '1day 4hours', expected: false },
      { input: 'abc', expected: false },
      { input: '', expected: false },
      { input: '   ', expected: false },
      { input: '  1d 4h  ', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(WorkValidator.isValidEstimate(input)).toBe(expected)
    })
  })
})
