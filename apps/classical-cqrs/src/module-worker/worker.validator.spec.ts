import WorkerValidator from './worker.validator'

describe('WorkerValidator', () => {
  describe('isValidHourlyRate', () => {
    const cases = [
      { input: '10.00', expected: true },
      { input: '0.99', expected: true },
      { input: '100.50', expected: true },
      { input: '100', expected: false },
      { input: '100.5', expected: false },
      { input: '100.500', expected: false },
      { input: 'abc', expected: false },
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 10.0, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(WorkerValidator.isValidHourlyRate(input)).toBe(expected)
    })
  })

  describe('isValidRole', () => {
    const cases = [
      { input: 'Manager', expected: true },
      { input: 'worker', expected: true },
      { input: '  admin  ', expected: false },
      { input: '', expected: false },
      { input: '   ', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 123, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(WorkerValidator.isValidRole(input)).toBe(expected)
    })
  })
})
