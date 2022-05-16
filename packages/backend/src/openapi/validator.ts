import assert from 'assert'
import Ajv2020, { ValidateFunction } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import Koa from 'koa'
import { convertParametersToJSONSchema } from 'openapi-jsonschema-parameters'
import { OpenAPIV3_1, IJsonSchema } from 'openapi-types'

import { HttpMethod } from './'
import { AppContext } from '../app'

type Response<T> = Omit<AppContext['response'], 'body'> & {
  body: T
}

type ResponseContext<T> = Omit<AppContext, 'response'> & {
  body: T
  response: Response<T>
}

interface RequestOptions {
  path: OpenAPIV3_1.PathItemObject
  method: HttpMethod
}

const ajv = new Ajv2020()
addFormats(ajv)
ajv.addFormat('uint64', (x) => {
  try {
    const value = BigInt(x)
    return value >= BigInt(0)
  } catch (e) {
    return false
  }
})

function getParametersSchema(
  parameters: OpenAPIV3_1.ParameterObject[]
): IJsonSchema[] {
  const schemas = convertParametersToJSONSchema(parameters)
  const allOf: IJsonSchema[] = []
  return ['path', 'query'].reduce((allOf, key) => {
    if (schemas[key]) {
      allOf.push({
        type: 'object',
        ...schemas[key]
      })
    }
    return allOf
  }, allOf)
}

export function createValidatorMiddleware<T extends Koa.Context>({
  path,
  method
}: RequestOptions): (
  ctx: AppContext,
  next: () => Promise<unknown>
) => Promise<void> {
  assert.ok(path[method])

  const validateParams =
    path.parameters &&
    ajv.compile<T['params']>({
      allOf: getParametersSchema(
        path.parameters as OpenAPIV3_1.ParameterObject[]
      )
    })

  // TODO:
  // Deserialize params
  // Assign default query parameter values
  const queryParams = path[method]?.parameters
  const validateQuery =
    queryParams &&
    ajv.compile<T['query']>({
      allOf: getParametersSchema(queryParams as OpenAPIV3_1.ParameterObject[])
    })

  const bodySchema = (path[method]
    ?.requestBody as OpenAPIV3_1.RequestBodyObject)?.content['application/json']
    .schema
  const validateBody = bodySchema && ajv.compile<T['body']>(bodySchema)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validate = (ctx: any): ctx is T => {
    const throwValidateError = (validate: ValidateFunction): void => {
      const error = validate.errors?.[0]
      ctx.throw(
        400,
        `${error?.instancePath.slice(1).replace('/', '.')} ${error?.message}`
      )
    }
    ctx.assert(ctx.accepts('application/json'), 406, 'must accept json')
    if (validateParams && !validateParams(ctx.params)) {
      throwValidateError(validateParams)
    }
    if (validateQuery && !validateQuery(ctx.request.query)) {
      throwValidateError(validateQuery)
    }
    if (validateBody) {
      ctx.assert(
        ctx.get('Content-Type') === 'application/json',
        400,
        'must send json body'
      )

      if (!validateBody(ctx.request.body)) {
        throwValidateError(validateBody)
      }
    }
    return true
  }
  return async (
    ctx: AppContext,
    next: () => Promise<unknown>
  ): Promise<void> => {
    if (validate(ctx)) {
      await next()
    } else {
      throw new Error('unreachable')
    }
  }
}

export function createResponseValidator<T>({
  path,
  method
}: // eslint-disable-next-line @typescript-eslint/no-explicit-any
RequestOptions): (ctx: any) => ctx is ResponseContext<T> {
  const responses = path[method]?.responses
  assert.ok(responses)

  const code = Object.keys(responses).find((code) => code.startsWith('20'))
  assert.ok(code)
  const bodySchema = (responses[code] as OpenAPIV3_1.ResponseObject).content?.[
    'application/json'
  ].schema
  assert.ok(bodySchema)
  const validateBody = ajv.compile<T>(bodySchema)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctx: any): ctx is ResponseContext<T> => {
    assert.equal(ctx.status.toString(), code)
    assert.equal(
      ctx.response.get('Content-Type'),
      'application/json; charset=utf-8'
    )
    if (!validateBody(ctx.response.body)) {
      const error = validateBody.errors?.[0]
      throw `${error?.instancePath.slice(1).replace('/', '.')} ${
        error?.message
      }`
    }
    return true
  }
}
