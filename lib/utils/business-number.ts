// Korean business number (사업자번호) checksum validation
// Weights: [1,3,7,1,3,7,1,3,5], 9th digit treated as floor((d8*5)/10) for check sum
export function validateBusinessNumber(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits.length !== 10) return false
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * weights[i]
  }
  sum += Math.floor((parseInt(digits[8]) * 5) / 10)
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === parseInt(digits[9])
}
