import { Model } from 'objection'

import { LiquidityAccount, OnCreditOptions } from '../../accounting/service'
import { ConnectorAccount } from '../../connector/core/rafiki'
import { Asset } from '../../asset/model'
import { BaseModel } from '../../shared/baseModel'
import { WebhookEvent } from '../../webhook/model'

export class PaymentPointer
  extends BaseModel
  implements ConnectorAccount, LiquidityAccount
{
  public static get tableName(): string {
    return 'paymentPointers'
  }

  static relationMappings = {
    asset: {
      relation: Model.HasOneRelation,
      modelClass: Asset,
      join: {
        from: 'paymentPointers.assetId',
        to: 'assets.id'
      }
    }
  }

  public url!: string
  public publicName?: string

  public readonly assetId!: string
  public asset!: Asset

  // The cumulative received amount tracked by
  // `payment_pointer.web_monetization` webhook events.
  // The value should be equivalent to the following query:
  // select sum(`withdrawalAmount`) from `webhookEvents` where `withdrawalAccountId` = `paymentPointer.id`
  public totalEventsAmount!: bigint
  public processAt!: Date | null

  public async onCredit({
    totalReceived,
    withdrawalThrottleDelay
  }: OnCreditOptions): Promise<PaymentPointer> {
    if (this.asset.withdrawalThreshold !== null) {
      const paymentPointer = await PaymentPointer.query()
        .patchAndFetchById(this.id, {
          processAt: new Date()
        })
        .whereRaw('?? <= ?', [
          'totalEventsAmount',
          totalReceived - this.asset.withdrawalThreshold
        ])
        .withGraphFetched('asset')
      if (paymentPointer) {
        return paymentPointer
      }
    }
    if (withdrawalThrottleDelay !== undefined && !this.processAt) {
      await this.$query().patch({
        processAt: new Date(Date.now() + withdrawalThrottleDelay)
      })
    }
    return this
  }

  public toData(received: bigint): PaymentPointerData {
    return {
      paymentPointer: {
        id: this.id,
        createdAt: new Date(+this.createdAt).toISOString(),
        received: received.toString()
      }
    }
  }
}

export enum PaymentPointerEventType {
  PaymentPointerWebMonetization = 'payment_pointer.web_monetization'
}

export type PaymentPointerData = {
  paymentPointer: {
    id: string
    createdAt: string
    received: string
  }
}

export class PaymentPointerEvent extends WebhookEvent {
  public type!: PaymentPointerEventType
  public data!: PaymentPointerData
}
