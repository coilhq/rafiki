import { useLoaderData, useLocation, json } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { ApiClient } from '~/lib/apiClient'
import { CONFIG as config } from '~/lib/parse_config.server'

export function loader() {
  return json({
    authServerDomain: config.authServerDomain,
    idpSecret: config.idpSecret
  })
}

function AuthorizedView({
  thirdPartyName,
  currencyDisplayCode,
  amount,
  interactId,
  nonce,
  authServerDomain
}: {
  thirdPartyName: string
  currencyDisplayCode: string
  amount: number
  interactId: string
  nonce: string
  authServerDomain: string
}) {
  return (
    <>
      <div className='row'>
        <div className='col-12'>
          <i className='bi bi-check-circle-fill text-success display-1'></i>
        </div>
      </div>
      <div className='row mt-2'>
        <div className='col-12'>
          <p>
            You gave {thirdPartyName} permission to send {currencyDisplayCode}{' '}
            {amount.toFixed(2)} out of your account.
          </p>
        </div>
      </div>
      <div className='row'>
        <button
          className='btn btn-primary'
          onClick={() => {
            ApiClient.endInteraction(interactId, nonce, authServerDomain)
          }}
        >
          Continue
        </button>
      </div>
    </>
  )
}

function RejectedView({
  thirdPartyName,
  interactId,
  nonce,
  authServerDomain
}: {
  thirdPartyName: string
  interactId: string
  nonce: string
  authServerDomain: string
}) {
  return (
    <>
      <div className='row'>
        <div className='col-12'>
          <i className='bi bi-x-circle-fill text-danger display-1'></i>
        </div>
      </div>
      <div className='row mt-2'>
        <div className='col-12'>
          <p>You denied {thirdPartyName} access to your account.</p>
        </div>
      </div>
      <div className='row'>
        <button
          className='btn btn-primary'
          onClick={() => {
            ApiClient.endInteraction(interactId, nonce, authServerDomain)
          }}
        >
          Continue
        </button>
      </div>
    </>
  )
}

export default function ShoeShop() {
  const { idpSecret, authServerDomain } = useLoaderData<typeof loader>()
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const [ctx, setCtx] = useState({
    done: false,
    authorized: false,
    interactId: '',
    nonce: '',
    grantId: queryParams.get('grantId'),
    thirdPartyName: queryParams.get('thirdPartyName'),
    thirdPartyUri: queryParams.get('thirdPartyUri'),
    currencyDisplayCode: queryParams.get('currencyDisplayCode'),
    amount:
      Number(queryParams.get('sendAmountValue')) /
      Math.pow(10, Number(queryParams.get('sendAmountScale')))
  })

  useEffect(() => {
    if (!ctx.done) {
      const interactId = queryParams.get('interactId')
      const nonce = queryParams.get('nonce')
      const decision = queryParams.get('decision')

      if (interactId && nonce) {
        const acceptanceDecision =
          !!decision && decision.toLowerCase() === 'accept'
        ApiClient.chooseConsent(
          interactId,
          nonce,
          acceptanceDecision,
          idpSecret
        )
          .then((_consentResponse) => {
            setCtx({
              ...ctx,
              done: true,
              authorized: acceptanceDecision,
              interactId,
              nonce
            })
          })
          .catch((_err) => {
            setCtx({
              ...ctx,
              done: true,
              interactId,
              nonce
            })
          })
      }
    }
  }, [ctx, queryParams])

  const thirdPartyUrl = new URL(ctx.thirdPartyUri ?? '')
  const thirdPartyOrigin = thirdPartyUrl.origin

  return (
    <>
      <div
        style={{
          background:
            'linear-gradient(0deg, rgba(9,9,121,0.8) 0%, rgba(193,1,250,0.8) 50%, rgba(9,9,121,0.8) 100%)',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: -1,
          width: '100%',
          height: '100%',
          opacity: '0.25',
          filter: 'sepia(0.75) invert(1)'
        }}
      >
        &nbsp;
      </div>
      <div className='card text-center mx-auto mt-3 w-50 p-3 justify-center'>
        <div className='card-body d-grid gap-3'>
          <div className='row mt-1'>
            <div className='col-12'>
              <div className='row'>
                <div className='col-12'>
                  <img
                    alt=''
                    src={`${thirdPartyOrigin}/favicon.ico`}
                    style={{ width: '167px' }}
                  ></img>
                  <img
                    alt=''
                    src='/wallet-logo.png'
                    style={{ width: '167px' }}
                  ></img>
                </div>
              </div>
              {ctx.authorized ? (
                <AuthorizedView
                  thirdPartyName={ctx.thirdPartyName || ''}
                  currencyDisplayCode={ctx.currencyDisplayCode || ''}
                  amount={ctx.amount}
                  interactId={ctx.interactId}
                  nonce={ctx.nonce}
                  authServerDomain={authServerDomain}
                />
              ) : (
                <RejectedView
                  thirdPartyName={ctx.thirdPartyName || ''}
                  interactId={ctx.interactId}
                  nonce={ctx.nonce}
                  authServerDomain={authServerDomain}
                />
              )}
            </div>
          </div>
          {/* <div className='row mt-3'>
            <div className='col-12'>
              <div className='row'>
                <div className='col-12'>Grant ID: {ctx.grantId}</div>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </>
  )
}
