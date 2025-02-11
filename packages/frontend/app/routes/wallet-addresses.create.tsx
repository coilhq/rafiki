import React, { useState } from 'react'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation
} from '@remix-run/react'
import { PageHeader } from '~/components'
import type { SelectOption } from '~/components/ui'
import { Button, ErrorPanel, Input, Select } from '~/components/ui'
import { loadAssets } from '~/lib/api/asset.server'
import { createWalletAddress } from '~/lib/api/wallet-address.server'
import { messageStorage, setMessageAndRedirect } from '~/lib/message.server'
import { createWalletAddressSchema } from '~/lib/validate.server'
import type { ZodFieldErrors } from '~/shared/types'
import {
  getOpenPaymentsUrl,
  removeTrailingAndLeadingSlash
} from '~/shared/utils'
import { checkAuthAndRedirect } from '../lib/kratos_checks.server'
import { type LoaderFunctionArgs } from '@remix-run/node'
import { whoami, loadTenants } from '~/lib/api/tenant.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookies = request.headers.get('cookie')
  await checkAuthAndRedirect(request.url, cookies)

  const assets = await loadAssets(request)
  const { isOperator } = await whoami(request)
  let tenants
  if (isOperator) {
    tenants = await loadTenants(request)
  }
  return json({ assets, tenants })
}

export default function CreateWalletAddressPage() {
  const { assets, tenants } = useLoaderData<typeof loader>()
  const response = useActionData<typeof action>()
  const { state } = useNavigation()
  const isSubmitting = state === 'submitting'
  const [tenantId, setTenantId] = useState<SelectOption | undefined>()

  const getAssetsOfTenant = (): SelectOption[] => {
    const assetsOfTenant = assets.filter(
      (asset) => asset.node.tenantId === tenantId?.value
    )
    return assetsOfTenant.map((asset) => ({
      value: asset.node.id,
      label: `${asset.node.code} (Scale: ${asset.node.scale})`
    }))
  }

  return (
    <div className='pt-4 flex flex-col space-y-4'>
      <div className='flex flex-col rounded-md bg-offwhite px-6'>
        <PageHeader>
          <h3 className='text-xl'>Create Wallet Address</h3>
          <Button
            aria-label='go back to wallet addresses page'
            to='/wallet-addresses'
          >
            Go back to wallet addresses page
          </Button>
        </PageHeader>
        <Form method='post' replace>
          <div className='px-6 pt-5'>
            <ErrorPanel errors={response?.errors.message} />
          </div>
          <fieldset disabled={isSubmitting}>
            <div className='grid grid-cols-1 px-0 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
              <div className='col-span-1 pt-3'>
                <h3 className='text-lg font-medium'>General Information</h3>
              </div>
              <div className='md:col-span-2 bg-white rounded-md shadow-md'>
                <div className='w-full p-4 space-y-3'>
                  <Input
                    required
                    addOn={getOpenPaymentsUrl()}
                    name='name'
                    label='Wallet address name'
                    placeholder='jdoe'
                    error={response?.errors?.fieldErrors.name}
                  />
                  <Input
                    name='publicName'
                    label='Public name'
                    placeholder='Public name'
                    error={response?.errors?.fieldErrors.publicName}
                  />
                  {tenants ? (
                    <Select
                      options={tenants.map((tenant) => ({
                        value: tenant.node.id,
                        label: `${tenant.node.id}`
                      }))}
                      name='tenantId'
                      placeholder='Select tenant...'
                      label='Tenant'
                      required
                      onChange={(value) => setTenantId(value)}
                      bringForward
                    />
                  ) : (
                    <Select
                      options={assets.map((asset) => ({
                        value: asset.node.id,
                        label: `${asset.node.code} (Scale: ${asset.node.scale})`
                      }))}
                      error={response?.errors.fieldErrors.asset}
                      name='asset'
                      placeholder='Select asset...'
                      label='Asset'
                      required
                    />
                  )}
                  {tenants && tenantId && (
                    <Select
                      options={getAssetsOfTenant()}
                      error={response?.errors.fieldErrors.asset}
                      name='asset'
                      placeholder='Select asset...'
                      label='Asset'
                      required
                    />
                  )}
                </div>
              </div>
            </div>
            <div className='flex justify-end py-3'>
              <Button aria-label='create wallet address' type='submit'>
                {isSubmitting ? 'Creating wallet address ...' : 'Create'}
              </Button>
            </div>
          </fieldset>
        </Form>
      </div>
    </div>
  )
}

export async function action({ request }: ActionFunctionArgs) {
  const errors: {
    fieldErrors: ZodFieldErrors<typeof createWalletAddressSchema>
    message: string[]
  } = {
    fieldErrors: {},
    message: []
  }

  const formData = Object.fromEntries(await request.formData())

  const result = createWalletAddressSchema.safeParse(formData)

  if (!result.success) {
    errors.fieldErrors = result.error.flatten().fieldErrors
    return json({ errors }, { status: 400 })
  }

  const baseUrl = removeTrailingAndLeadingSlash(getOpenPaymentsUrl())
  const path = removeTrailingAndLeadingSlash(result.data.name)

  const response = await createWalletAddress(request, {
    url: `${baseUrl}/${path}`,
    publicName: result.data.publicName,
    assetId: result.data.asset,
    tenantId: result.data.tenantId,
    additionalProperties: []
  })

  if (!response?.walletAddress) {
    errors.message = ['Could not create wallet address. Please try again!']
    return json({ errors }, { status: 400 })
  }

  const session = await messageStorage.getSession(request.headers.get('cookie'))

  return setMessageAndRedirect({
    session,
    message: {
      content: 'Wallet address was created.',
      type: 'success'
    },
    location: `/wallet-addresses/${response.walletAddress?.id}`
  })
}
