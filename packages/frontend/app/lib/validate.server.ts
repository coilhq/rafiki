import { z } from 'zod'
import { isValidIlpAddress } from 'ilp-packet'
import { WebhookEventType } from '~/shared/enums'
import { WalletAddressStatus, PaymentType } from '~/generated/graphql'

export const uuidSchema = z.object({
  id: z.string().uuid()
})

export const paginationSchema = z
  .object({
    after: z.string().uuid(),
    before: z.string().uuid(),
    first: z.coerce.number().int().positive(),
    last: z.coerce.number().int().positive()
  })
  .partial()

export const webhooksSearchParams = paginationSchema.merge(
  z.object({
    type: z.array(z.nativeEnum(WebhookEventType)).default([])
  })
)

export const paymentsSearchParams = paginationSchema.merge(
  z.object({
    type: z.array(z.nativeEnum(PaymentType)).default([]),
    walletAddressId: z.string().uuid().optional()
  })
)

export const peerGeneralInfoSchema = z
  .object({
    name: z.string().optional(),
    staticIlpAddress: z
      .string()
      .refine((ilpAddress) => isValidIlpAddress(ilpAddress), {
        message: 'The provided ILP Address is not valid.'
      }),
    maxPacketAmount: z.coerce
      .bigint({
        invalid_type_error: 'Max packet amount is expected to be a number.'
      })
      .optional()
  })
  .merge(uuidSchema)

export const peerHttpInfoSchema = z
  .object({
    incomingAuthTokens: z.string().optional(),
    outgoingAuthToken: z.string(),
    outgoingEndpoint: z
      .string()
      .url({ message: 'Invalid outgoing HTTP endpoint URL.' })
  })
  .merge(uuidSchema)

export const peerAssetInfoSchema = z
  .object({
    asset: z.string().uuid({ message: 'Invalid asset.' })
  })
  .merge(uuidSchema)

export const createPeerSchema = peerGeneralInfoSchema
  .merge(peerHttpInfoSchema)
  .merge(peerAssetInfoSchema)
  .omit({ id: true })

export const updateAssetSchema = z
  .object({
    withdrawalThreshold: z.coerce
      .bigint({
        invalid_type_error: 'Max packet amount is expected to be a number.'
      })
      .optional()
  })
  .merge(uuidSchema)

export const setAssetFeeSchema = z.object({
  assetId: z.string().uuid(),
  basisPoints: z.coerce
    .number()
    .int()
    .min(0, { message: 'Basis points should be from 0 to 10000' })
    .max(10000, { message: 'Basis points should be from 0 to 10000' }),
  fixed: z.coerce
    .bigint({
      invalid_type_error: 'Fixed Fee amount is expected to be a number.'
    })
    .nonnegative()
})

export const createAssetSchema = z
  .object({
    code: z
      .string()
      .min(3, { message: 'Code should be atleast 3 characters long' })
      .max(6, { message: 'Maximum length of Code is 6 characters' })
      .regex(/^[a-zA-Z]+$/, { message: 'Code should only contain letters.' })
      .transform((code) => code.toUpperCase()),
    scale: z.coerce
      .number({
        invalid_type_error: 'Max packet amount is expected to be a number.'
      })
      .int()
      .min(0, { message: 'Scale should be from 0 to 255' })
      .max(255, { message: 'Scale should be from 0 to 255' }),
    tenantId: z.string().optional()
  })
  .merge(updateAssetSchema)
  .omit({ id: true })

export const amountSchema = z.coerce
  .bigint({
    invalid_type_error: 'Amount is expected to be a number.'
  })
  .positive()

export const createWalletAddressSchema = z.object({
  name: z.string().min(1),
  publicName: z.string().optional(),
  asset: z.string().uuid(),
  tenantId: z.string().uuid().optional()
})

export const updateWalletAddressSchema = z
  .object({
    publicName: z.string().optional(),
    status: z.enum([WalletAddressStatus.Active, WalletAddressStatus.Inactive])
  })
  .merge(uuidSchema)
