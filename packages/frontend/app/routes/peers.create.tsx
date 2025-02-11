import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs
} from '@remix-run/node'
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation
} from '@remix-run/react'
import { PageHeader } from '~/components/PageHeader'
import type { SelectOption } from '~/components/ui'
import { Button, ErrorPanel, Input, Select } from '~/components/ui'
import { loadAssets } from '~/lib/api/asset.server'
import { createPeer } from '~/lib/api/peer.server'
import { messageStorage, setMessageAndRedirect } from '~/lib/message.server'
import { createPeerSchema } from '~/lib/validate.server'
import type { ZodFieldErrors } from '~/shared/types'
import { checkAuthAndRedirect } from '../lib/kratos_checks.server'
import type { RedirectDialogRef } from '~/components/RedirectDialog'
import { RedirectDialog } from '~/components/RedirectDialog'
import { useEffect, useRef, useState } from 'react'
import { loadTenants, whoami } from '~/lib/api/tenant.server'

export async function loader({ request }: LoaderFunctionArgs) {
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

export default function CreatePeerPage() {
  const { assets, tenants } = useLoaderData<typeof loader>()
  const response = useActionData<typeof action>()
  const { state } = useNavigation()
  const isSubmitting = state === 'submitting'
  const dialogRef = useRef<RedirectDialogRef>(null)
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

  useEffect(() => {
    if (assets.length === 0) {
      dialogRef.current?.display()
    }
  }, [])

  return (
    <>
      <RedirectDialog
        ref={dialogRef}
        title='Before You Continue'
        message='Please note: you must have at least one asset before you can create a peer.'
        redirectPath={'/assets/create'}
        redirectButtonText={'Create Asset'}
      ></RedirectDialog>

      <div className='pt-4 flex flex-col space-y-4'>
        <div className='flex flex-col rounded-md bg-offwhite px-6'>
          <PageHeader>
            <h3 className='text-xl'>Create Peer</h3>
            <Button aria-label='go back to peers page' to='/peers'>
              Go to peers page
            </Button>
          </PageHeader>
          {/* Create Peer form */}
          <Form method='post' replace>
            <div className='px-6 pt-5'>
              <ErrorPanel errors={response?.errors.message} />
            </div>

            <fieldset disabled={isSubmitting}>
              {/* Peer General Info */}
              <div className='grid grid-cols-1 px-0 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
                <div className='col-span-1 pt-3'>
                  <h3 className='text-lg font-medium'>General Information</h3>
                </div>
                <div className='md:col-span-2 bg-white rounded-md shadow-md'>
                  <div className='w-full p-4 space-y-3'>
                    <Input
                      name='name'
                      label='Name'
                      placeholder='Peer name'
                      error={response?.errors?.fieldErrors.name}
                      description={
                        <>
                          The name of the{' '}
                          <a
                            className='default-link'
                            href='https://rafiki.dev/resources/glossary#peer'
                          >
                            peer
                          </a>{' '}
                          to be added.
                        </>
                      }
                    />
                    <Input
                      name='staticIlpAddress'
                      label='Static ILP Address'
                      placeholder='ILP Address'
                      required
                      error={response?.errors?.fieldErrors?.staticIlpAddress}
                      description={
                        <>
                          {"The peer's "}
                          <a
                            className='default-link'
                            href='https://interledger.org/developers/rfcs/ilp-addresses/'
                          >
                            address on the Interledger network.
                          </a>
                        </>
                      }
                    />
                    <Input
                      name='maxPacketAmount'
                      label='Max Packet Amount'
                      placeholder='Max Packet Amount'
                      error={response?.errors?.fieldErrors?.maxPacketAmount}
                      description={
                        <>
                          The maximum amount of value that can be sent in a
                          single{' '}
                          <a
                            className='default-link'
                            href='https://interledger.org/developers/rfcs/stream-protocol/#35-packets-and-frames'
                          >
                            Interledger STREAM Packet
                          </a>
                          .
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
              {/* Peer General Info - END */}
              {/* Peer HTTP Info */}
              <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
                <div className='col-span-1 pt-3'>
                  <h3 className='text-lg font-medium'>HTTP Information</h3>
                </div>
                <div className='md:col-span-2 bg-white rounded-md shadow-md'>
                  <div className='w-full p-4 space-y-3'>
                    <Input
                      name='incomingAuthTokens'
                      label='Incoming Auth Tokens'
                      placeholder='Accepts a comma separated list of tokens'
                      error={response?.errors?.fieldErrors?.incomingAuthTokens}
                      description={
                        <>
                          List of valid tokens to accept when receiving incoming{' '}
                          <a
                            className='default-link'
                            href='https://rafiki.dev/integration/deployment/services/backend-service/#interledger-connector'
                          >
                            ILP packets
                          </a>{' '}
                          from the peer.
                        </>
                      }
                    />
                    <Input
                      name='outgoingAuthToken'
                      label='Outgoing Auth Token'
                      placeholder='Outgoing HTTP Auth Token'
                      required
                      error={response?.errors?.fieldErrors?.outgoingAuthToken}
                      description={
                        <>
                          Valid auth token to present when sending outgoing{' '}
                          <a
                            className='default-link'
                            href='https://rafiki.dev/integration/deployment/services/backend-service/#interledger-connector'
                          >
                            ILP packets
                          </a>{' '}
                          to the peer.
                        </>
                      }
                    />
                    <Input
                      name='outgoingEndpoint'
                      label='Outgoing Endpoint'
                      placeholder='Outgoing HTTP Endpoint'
                      required
                      error={response?.errors?.fieldErrors?.outgoingEndpoint}
                      description={
                        <>
                          Endpoint on the peer to which outgoing ILP packets
                          will be sent.
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
              {/* Peer HTTP Info - END */}
              {/* Peer Asset */}
              <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
                <div className='col-span-1 pt-3'>
                  <h3 className='text-lg font-medium'>Asset Information</h3>
                </div>
                <div className='md:col-span-2 bg-white rounded-md shadow-md'>
                  <div className='w-full p-4 space-y-3'>
                    {tenants ? (
                      <Select
                        options={tenants.map((tenant) => ({
                          value: tenant.node.id,
                          label: `${tenant.node.id} ${tenant.node.publicName ? `(${tenant.node.publicName})` : ''}`
                        }))}
                        name='tenantId'
                        placeholder='Select tenant...'
                        required
                        onChange={(value) => setTenantId(value)}
                        description={
                          <>
                            The tenant whose{' '}
                            <a
                              className='default-link'
                              href='https://rafiki.dev/overview/concepts/accounting#assets'
                            >
                              asset
                            </a>{' '}
                            will sent to & received from the peer.
                          </>
                        }
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
                        description={
                          <>
                            The type of{' '}
                            <a
                              className='default-link'
                              href='https://rafiki.dev/overview/concepts/accounting#assets'
                            >
                              asset
                            </a>{' '}
                            that is sent to & received from the peer.
                          </>
                        }
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
                        description={
                          <>
                            The type of{' '}
                            <a
                              className='default-link'
                              href='https://rafiki.dev/overview/concepts/accounting#assets'
                            >
                              asset
                            </a>{' '}
                            that is sent to & received from the peer.
                          </>
                        }
                        required
                      />
                    )}
                  </div>
                </div>
              </div>
              {/* Peer Asset - End */}
              <div className='flex justify-end py-3'>
                <Button aria-label='create peer' type='submit'>
                  {isSubmitting ? 'Creating peer ...' : 'Create'}
                </Button>
              </div>
            </fieldset>
          </Form>
          {/* Create Peer form - END */}
        </div>
      </div>
    </>
  )
}

export async function action({ request }: ActionFunctionArgs) {
  const errors: {
    fieldErrors: ZodFieldErrors<typeof createPeerSchema>
    message: string[]
  } = {
    fieldErrors: {},
    message: []
  }

  const formData = Object.fromEntries(await request.formData())

  const result = createPeerSchema.safeParse(formData)

  if (!result.success) {
    errors.fieldErrors = result.error.flatten().fieldErrors
    return json({ errors }, { status: 400 })
  }

  const response = await createPeer(request, {
    name: result.data.name,
    http: {
      outgoing: {
        endpoint: result.data.outgoingEndpoint,
        authToken: result.data.outgoingAuthToken
      },
      incoming: result.data.incomingAuthTokens
        ? {
            authTokens: result.data.incomingAuthTokens
              ?.replace(/ /g, '')
              .split(',')
          }
        : undefined
    },
    assetId: result.data.asset,
    staticIlpAddress: result.data.staticIlpAddress,
    ...(result.data.maxPacketAmount
      ? { maxPacketAmount: result.data.maxPacketAmount }
      : { maxPacketAmount: undefined })
  })

  if (!response?.peer) {
    errors.message = ['Could not create peer. Please try again!']
    return json({ errors }, { status: 400 })
  }

  const session = await messageStorage.getSession(request.headers.get('cookie'))

  return setMessageAndRedirect({
    session,
    message: {
      content: 'Peer created.',
      type: 'success'
    },
    location: `/peers/${response.peer?.id}`
  })
}
