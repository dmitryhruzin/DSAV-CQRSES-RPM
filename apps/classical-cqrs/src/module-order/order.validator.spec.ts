import OrderValidator from './order.validator'

describe('OrderValidator', () => {
  describe('isValidTitle', () => {
    const cases = [
      { input: 'Order 1', expected: true },
      { input: '  Order 2', expected: false },
      { input: 'Order 3  ', expected: false },
      { input: '', expected: false },
      { input: '   ', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(OrderValidator.isValidTitle(input)).toBe(expected)
    })
  })

  describe('isValidPrice', () => {
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
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(OrderValidator.isValidPrice(input)).toBe(expected)
    })
  })

  describe('isValidPriority', () => {
    const cases = [
      { input: 1, expected: true },
      { input: 3, expected: true },
      { input: 5, expected: true },
      { input: 0, expected: false },
      { input: 6, expected: false },
      { input: -1, expected: false },
      { input: 2.5, expected: false },
      { input: '3', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(OrderValidator.isValidPriority(input)).toBe(expected)
    })
  })
})
