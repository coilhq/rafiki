import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '..'
import { AppServices } from '../app'
import { Config } from '../config/app'
import { ConvertError, RatesService } from '../rates/service'
import { TestContainer, createTestApp } from '../tests/app'
import { mockCounter, mockHistogram } from '../tests/telemetry'
import { TelemetryService } from './service'
import { Counter, Histogram } from '@opentelemetry/api'
import { privacy } from './privacy'

jest.mock('@opentelemetry/api', () => ({
  ...jest.requireActual('@opentelemetry/api'),
  metrics: {
    setGlobalMeterProvider: jest.fn(),
    getMeter: jest.fn().mockReturnValue({
      createCounter: jest.fn().mockImplementation(() => mockCounter),
      createHistogram: jest.fn().mockImplementation(() => mockHistogram)
    })
  }
}))

jest.mock('@opentelemetry/resources', () => ({ Resource: jest.fn() }))

jest.mock('@opentelemetry/sdk-metrics', () => ({
  MeterProvider: jest.fn().mockImplementation(() => ({
    shutdown: jest.fn(),
    addMetricReader: jest.fn()
  }))
}))

describe('TelemetryServiceImpl', () => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let telemetryService: TelemetryService
  let aseRatesService: RatesService
  let internalRatesService: RatesService

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({
      ...Config,
      enableTelemetry: true,
      telemetryExchangeRatesUrl: 'http://example-rates.com',
      telemetryExchangeRatesLifetime: 100,
      openTelemetryCollectors: []
    })

    appContainer = await createTestApp(deps)
    telemetryService = await deps.use('telemetry')!
    aseRatesService = await deps.use('ratesService')!
    internalRatesService = await deps.use('internalRatesService')!
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  it('should create a counter with source attribute for a new metric', () => {
    const name = 'test_counter'
    const amount = 1
    const attributes = { test: 'attribute' }

    telemetryService.incrementCounter(name, amount, attributes)

    expect(mockCounter.add).toHaveBeenCalledWith(
      amount,
      expect.objectContaining({
        ...attributes,
        source: expect.any(String)
      })
    )
  })

  it('should create a histogram with source attribute for a new metric', () => {
    const name = 'test_histogram'
    const amount = 1
    const attributes = { test: 'attribute' }

    telemetryService.recordHistogram(name, amount, attributes)

    expect(mockHistogram.record).toHaveBeenCalledWith(
      amount,
      expect.objectContaining({
        ...attributes,
        source: expect.any(String)
      })
    )
  })

  it('should use existing counter when incrementCounter is called for an existing metric', () => {
    const name = 'test_counter'

    telemetryService.incrementCounter(name, 1)
    telemetryService.incrementCounter(name, 1)

    //"any" to access private ts class member variable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const counters: Map<string, Counter> = (telemetryService as any).counters

    expect(counters.size).toBe(1)
    expect(counters.has(name)).toBe(true)

    const counter = counters.get(name)
    expect(counter?.add).toHaveBeenCalledTimes(2)
  })

  it('should use existing histogram when recordHistogram is called for an existing metric', () => {
    const name = 'test_histogram'

    telemetryService.recordHistogram(name, 1)
    telemetryService.recordHistogram(name, 1)

    //"any" to access private ts class member variable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const histograms: Map<string, Histogram> = (telemetryService as any)
      .histograms

    expect(histograms.size).toBe(1)
    expect(histograms.has(name)).toBe(true)

    const histogram = histograms.get(name)
    expect(histogram?.record).toHaveBeenCalledTimes(2)
  })

  describe('incrementCounterWithTransactionAmount', () => {
    it('should try to convert using aseRatesService and fallback to internalRatesService', async () => {
      const aseConvertSpy = jest
        .spyOn(aseRatesService, 'convert')
        .mockImplementation(() =>
          Promise.resolve(ConvertError.InvalidDestinationPrice)
        )
      const internalConvertSpy = jest
        .spyOn(internalRatesService, 'convert')
        .mockImplementation(() => Promise.resolve(10000n))

      await telemetryService.incrementCounterWithTransactionAmount(
        'test_counter',
        {
          value: 100n,
          assetCode: 'USD',
          assetScale: 2
        }
      )

      expect(aseConvertSpy).toHaveBeenCalled()
      expect(internalConvertSpy).toHaveBeenCalled()
    })

    it('should not call the fallback internalRatesService if aseRatesService call is successful', async () => {
      const aseConvertSpy = jest
        .spyOn(aseRatesService, 'convert')
        .mockImplementation(() => Promise.resolve(500n))
      const internalConvertSpy = jest.spyOn(internalRatesService, 'convert')

      await telemetryService.incrementCounterWithTransactionAmount(
        'test_counter',
        {
          value: 100n,
          assetCode: 'USD',
          assetScale: 2
        }
      )

      expect(aseConvertSpy).toHaveBeenCalled()
      expect(internalConvertSpy).not.toHaveBeenCalled()
    })

    it('should apply privacy', async () => {
      const convertedAmount = 500n

      jest
        //"any" to access private ts class member variable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(telemetryService as any, 'convertAmount')
        .mockImplementation(() => Promise.resolve(convertedAmount))
      const applyPrivacySpy = jest
        .spyOn(privacy, 'applyPrivacy')
        .mockReturnValue(123)
      const incrementCounterSpy = jest.spyOn(
        telemetryService,
        'incrementCounter'
      )

      const counterName = 'test_counter'
      await telemetryService.incrementCounterWithTransactionAmount(
        counterName,
        {
          value: 100n,
          assetCode: 'USD',
          assetScale: 2
        }
      )

      expect(applyPrivacySpy).toHaveBeenCalledWith(Number(convertedAmount))
      expect(incrementCounterSpy).toHaveBeenCalledWith(
        counterName,
        123,
        expect.any(Object)
      )
    })

    it('should not collect telemetry when conversion returns InvalidDestinationPrice', async () => {
      const convertSpy = jest
        //"any" to access private ts class member variable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(telemetryService as any, 'convertAmount')
        .mockImplementation(() =>
          Promise.resolve(ConvertError.InvalidDestinationPrice)
        )

      const incrementCounterSpy = jest.spyOn(
        telemetryService,
        'incrementCounter'
      )

      await telemetryService.incrementCounterWithTransactionAmount(
        'test_counter',
        {
          value: 100n,
          assetCode: 'USD',
          assetScale: 2
        }
      )

      expect(convertSpy).toHaveBeenCalled()
      expect(incrementCounterSpy).not.toHaveBeenCalled()
    })

    it('should collect telemetry when conversion is successful', async () => {
      const convertSpy = jest
        //"any" to access private ts class member variable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(telemetryService as any, 'convertAmount')
        .mockImplementation(() => Promise.resolve(10000n))
      const incrementCounterSpy = jest.spyOn(
        telemetryService,
        'incrementCounter'
      )
      const obfuscatedAmount = 12000
      jest.spyOn(privacy, 'applyPrivacy').mockReturnValue(obfuscatedAmount)

      const counterName = 'test_counter'

      await telemetryService.incrementCounterWithTransactionAmount(
        counterName,
        {
          value: 100n,
          assetCode: 'USD',
          assetScale: 2
        }
      )

      expect(convertSpy).toHaveBeenCalled()
      expect(incrementCounterSpy).toHaveBeenCalledWith(
        counterName,
        obfuscatedAmount,
        expect.any(Object)
      )
    })
  })
})
