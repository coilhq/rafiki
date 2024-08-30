import axios from 'axios'
import { TransactionOrKnex } from 'objection'
import { BaseService } from '../shared/baseService'
import { TenantError } from './errors'
import { Tenant } from './model'
import { IAppConfig } from '../config/app'
import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import {
  Tenant as AuthTenant,
  CreateTenantInput as CreateAuthTenantInput
} from '../generated/graphql'
import { Pagination, SortOrder } from '../shared/baseModel'
import { EndpointOptions, TenantEndpointService } from './endpoints/service'

export interface CreateTenantOptions {
  idpConsentEndpoint: string
  idpSecret: string
  endpoints: EndpointOptions[]
  email: string
  isOperator?: boolean
}

export interface TenantService {
  get(id: string): Promise<Tenant | undefined>
  getByIdentity(id: string): Promise<Tenant | undefined>
  getPage(pagination?: Pagination, sortOrder?: SortOrder): Promise<Tenant[]>
  create(createOptions: CreateTenantOptions): Promise<Tenant | TenantError>
}

export interface ServiceDependencies extends BaseService {
  knex: TransactionOrKnex
  config: IAppConfig
  apolloClient: ApolloClient<NormalizedCacheObject>
  tenantEndpointService: TenantEndpointService
}

export async function createTenantService(
  deps_: ServiceDependencies
): Promise<TenantService> {
  const deps: ServiceDependencies = {
    logger: deps_.logger.child({
      service: 'TenantService'
    }),
    knex: deps_.knex,
    config: deps_.config,
    apolloClient: deps_.apolloClient,
    tenantEndpointService: deps_.tenantEndpointService
  }

  return {
    get: (id: string) => getTenant(deps, id),
    getByIdentity: (id: string) => getByIdentity(deps, id),
    getPage: (pagination?, sortOrder?) =>
      getTenantsPage(deps, pagination, sortOrder),
    create: (options: CreateTenantOptions) => createTenant(deps, options)
  }
}

async function getTenantsPage(
  deps: ServiceDependencies,
  pagination?: Pagination,
  sortOrder?: SortOrder
): Promise<Tenant[]> {
  return await Tenant.query(deps.knex).getPage(pagination, sortOrder)
}

async function getTenant(
  deps: ServiceDependencies,
  id: string
): Promise<Tenant | undefined> {
  return Tenant.query(deps.knex).withGraphFetched('endpoints').findById(id)
}

// TODO: tests for this service function
async function getByIdentity(
  deps: ServiceDependencies,
  id: string
): Promise<Tenant | undefined> {
  return Tenant.query(deps.knex).findOne({
    kratosIdentityId: id
  })
}

async function createTenant(
  deps: ServiceDependencies,
  options: CreateTenantOptions
): Promise<Tenant | TenantError> {
  /**
   * 1. Open DB transaction
   * 2. Insert tenant data into DB
   * 3. Call Auth Admin API to create tenant
   * 3.1 if success, commit DB trx and return tenant data
   * 3.2 if error, rollback DB trx and return error
   */
  return deps.knex.transaction(async (trx) => {
    let tenant: Tenant
    try {
      const { kratosAdminUrl } = deps.config
      let identityId
      const getIdentityResponse = await axios.get(
        `${kratosAdminUrl}/identities?credentials_identifier=${options.email}`
      )
      if (
        getIdentityResponse.data.length > 0 &&
        getIdentityResponse.data[0].id
      ) {
        identityId = getIdentityResponse.data[0].id
      } else {
        const createIdentityResponse = await axios.post(
          `${kratosAdminUrl}/identities`,
          {
            schema_id: 'default',
            traits: {
              email: options.email
            },
            metadata_public: {
              operator: options.isOperator
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )

        identityId = createIdentityResponse.data.id
      }

      const recoveryRequest = await axios.post(
        `${kratosAdminUrl}/recovery/link`,
        {
          identity_id: identityId
        }
      )
      deps.logger.info(
        `Recovery link for ${options.email} at ${recoveryRequest.data.recovery_link}`
      )
      // create tenant on backend
      tenant = await Tenant.query(trx).insert({
        email: options.email,
        kratosIdentityId: identityId
      })

      await deps.tenantEndpointService.create({
        endpoints: options.endpoints,
        tenantId: tenant.id,
        trx
      })

      // call auth admin api
      const mutation = gql`
        mutation CreateAuthTenant($input: CreateTenantInput!) {
          createTenant(input: $input) {
            tenant {
              id
            }
      `
      const variables = {
        input: {
          tenantId: tenant.id,
          idpSecret: options.idpSecret,
          idpConsentEndpoint: options.idpConsentEndpoint
        }
      }

      await deps.apolloClient.mutate<
        AuthTenant,
        { input: CreateAuthTenantInput }
      >({
        mutation,
        variables
      })
      await trx.commit()
      return tenant
    } catch (err) {
      await trx.rollback()
      throw err
    }
  })
}
