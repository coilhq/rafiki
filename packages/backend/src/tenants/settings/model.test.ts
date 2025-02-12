import { TenantSetting } from './model'

describe('TenantSetting Model', (): void => {
  describe('dfeault', () => {
    test('can specify default settings', async (): Promise<void> => {
      expect(TenantSetting.default()).toEqual([
        { key: 'WEBHOOK_TIMEOUT', value: '2000' },
        { key: 'WEBHOOK_MAX_RETRY', value: '10' }
      ])
    })
  })
})
