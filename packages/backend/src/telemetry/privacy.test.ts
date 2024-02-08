import { privacy } from './privacy'
describe('Privacy functions', () => {
  const clipParams = {
    minBucketSize: 1000,
    maxBucketSize: 10000
  }

  let originalModule: typeof privacy

  beforeEach(() => {
    originalModule = { ...privacy }

    jest.mock('./privacy', () => ({
      ...originalModule,
      applyPrivacy: jest.fn()
    }))
  })

  afterEach(() => {
    jest.unmock('./privacy')
  })

  test('generateLaplaceNoise should return a different number each time', () => {
    const scale = 0.5
    const noise1 = privacy.generateLaplaceNoise(scale)
    const noise2 = privacy.generateLaplaceNoise(scale)
    expect(noise1).not.toBe(noise2)
  })

  test('computePrivacyParameter should return 0 when sensitivity is 0', () => {
    const sensitivity = 0
    const privacyParameter = privacy.computePrivacyParameter(sensitivity)
    expect(privacyParameter).toBe(0)
  })

  test('roundValue should return minBucketSize when rawValue is very small', () => {
    const rawValue = 10
    const bucketSize = 1000
    const roundedValue = privacy.roundValue(rawValue, bucketSize, clipParams)
    expect(roundedValue).toBe(clipParams.minBucketSize)
  })

  test('roundValue should return maxBucketSize when rawValue is very large', () => {
    const rawValue = 1000000
    const bucketSize = 1000
    const roundedValue = privacy.roundValue(rawValue, bucketSize, clipParams)
    expect(roundedValue).toBe(clipParams.maxBucketSize)
  })

  test('roundValue should return a number within the specified range', () => {
    const rawValue = 5000
    const bucketSize = 1000
    const roundedValue = privacy.roundValue(rawValue, bucketSize, clipParams)
    expect(roundedValue).toBeGreaterThanOrEqual(clipParams.minBucketSize)
    console.log(roundedValue)
    expect(roundedValue).toBeLessThanOrEqual(clipParams.maxBucketSize)
  })

  test('getBucketSize should return maxBucketSize when rawValue is very large', () => {
    const rawValue = 1000000
    const bucketSize = privacy.getBucketSize(rawValue, clipParams)
    expect(bucketSize).toBe(clipParams.maxBucketSize)
  })

  test('getBucketSize should return minBucketSize when rawValue is very small', () => {
    const rawValue = 10
    const bucketSize = privacy.getBucketSize(rawValue, clipParams)
    expect(bucketSize).toBe(clipParams.minBucketSize)
  })

  test('getBucketSize should return a number within the specified range', () => {
    const rawValue = 5000
    const bucketSize = privacy.getBucketSize(rawValue, clipParams)
    expect(bucketSize).toBeGreaterThanOrEqual(clipParams.minBucketSize)
    expect(bucketSize).toBeLessThanOrEqual(clipParams.maxBucketSize)
  })

  test('applyPrivacy should call all the necessary functions with the correct arguments', () => {
    const rawValue = 5000

    const mockPrivacy = {
      ...privacy,
      getBucketSize: jest.fn().mockReturnValue(1000),
      generateLaplaceNoise: jest.fn().mockReturnValue(0),
      computePrivacyParameter: jest.fn().mockReturnValue(0.1),
      roundValue: jest.fn().mockReturnValue(500)
    }

    const applyPrivacy = privacy.applyPrivacy.bind(mockPrivacy)

    const result = applyPrivacy(rawValue, clipParams)

    expect(mockPrivacy.getBucketSize).toHaveBeenCalledWith(rawValue, clipParams)
    expect(mockPrivacy.computePrivacyParameter).toHaveBeenCalledWith(
      Math.max(500 / 10, 1000)
    )
    expect(mockPrivacy.generateLaplaceNoise).toHaveBeenCalledWith(0.1)
    expect(mockPrivacy.roundValue).toHaveBeenCalledWith(
      rawValue,
      1000,
      clipParams
    )

    expect(result).toBe(500)
  })
})
