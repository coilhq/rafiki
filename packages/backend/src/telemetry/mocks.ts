import { Attributes, Counter, MetricOptions } from '@opentelemetry/api'
import { TelemetryService } from './service'
import { ConvertError, Rates, RatesService } from '../rates/service'

export const mockCounter = { add: jest.fn() } as Counter

export class MockRatesService implements RatesService {
  async convert(): Promise<bigint | ConvertError> {
    return BigInt(10000)
  }
  async rates(): Promise<Rates> {
    return {
      base: 'USD',
      rates: {
        BGN: 0.55,
        BNB: 249.39,
        BTC: 40829.24,
        ETH: 2162.15,
        EUR: 1.08,
        GBP: 1.25,
        RON: 0.22,
        USD: 1,
        XRP: 0.5994
      }
    }
  }
}

export class MockTelemetryService implements TelemetryService {
  ratesService = new MockRatesService()
  getOrCreate(
    _name: string,
    _options?: MetricOptions | undefined
  ): Counter<Attributes> {
    return mockCounter
  }
  getServiceName(): string | undefined {
    return 'serviceName'
  }

  getRatesService(): RatesService {
    return this.ratesService
  }

  getBaseAssetCode(): string {
    return 'USD'
  }

  getBaseScale(): number {
    return 4
  }

  applyPrivacy(rawValue: number): number {
    return rawValue + Math.random() * 100
  }
}
