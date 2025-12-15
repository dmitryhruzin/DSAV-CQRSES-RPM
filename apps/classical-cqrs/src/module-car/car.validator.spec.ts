import CarValidator from './car.validator'

describe('CarValidator', () => {
  describe('isValidMileage', () => {
    const cases = [
      { input: 0, expected: true },
      { input: 100000, expected: true },
      { input: 50000.5, expected: true },
      { input: -1, expected: false },
      { input: -100, expected: false },
      { input: '50000', expected: false },
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: {}, expected: false },
      { input: [], expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(CarValidator.isValidMileage(input)).toBe(expected)
    })
  })

  describe('isValidVin', () => {
    const cases = [
      { input: '1HGBH41JXMN109186', expected: true },
      { input: 'JM1BL1SF7A1216545', expected: true },
      { input: 'WVWZZZ1JZ3W386752', expected: true },
      { input: '1HGBH41JXMN10918', expected: false }, // 16 chars
      { input: '1HGBH41JXMN1091866', expected: false }, // 18 chars
      { input: '1HGBH41JXMN10918I', expected: false }, // contains I
      { input: '1HGBH41JXMN10918O', expected: false }, // contains O
      { input: '1HGBH41JXMN10918Q', expected: false }, // contains Q
      { input: '1hgbh41jxmn109186', expected: false }, // lowercase
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 12345678901234567, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(CarValidator.isValidVin(input)).toBe(expected)
    })
  })

  describe('isValidRegistrationNumber', () => {
    const cases = [
      { input: 'AE7199OB', expected: true },
      { input: 'KY1234AA', expected: true },
      { input: 'BC5678XZ', expected: true },
      { input: 'AE719OB', expected: false }, // 3 digits instead of 4
      { input: 'AE71999OB', expected: false }, // 5 digits instead of 4
      { input: 'A7199OB', expected: false }, // 1 letter at start
      { input: 'AE7199O', expected: false }, // 1 letter at end
      { input: 'ae7199ob', expected: false }, // lowercase
      { input: 'AE7199OB1', expected: false }, // extra character
      { input: '7199AEOB', expected: false }, // wrong format
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
      { input: 12345678, expected: false },
      { input: {}, expected: false }
    ]

    it.each(cases)('should return $expected for input $input', ({ input, expected }) => {
      // @ts-expect-error
      expect(CarValidator.isValidRegistrationNumber(input)).toBe(expected)
    })
  })
})
