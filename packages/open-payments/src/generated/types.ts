/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
  "/": {
    /**
     * Retrieve the public information of the Payment Pointer.
     *
     * This end-point should be open to anonymous requests as it allows clients to verify a Payment Pointer URL and get the basic information required to construct new transactions and discover the grant request URL.
     *
     * The content should be slow changing and cacheable for long periods. Servers SHOULD use cache control headers.
     */
    get: operations["get-payment-pointer"];
  };
  "/connections/{id}": {
    /**
     * *NB* Use server url specific to this path.
     *
     * Fetch new connection credentials for an ILP STREAM connection.
     *
     * A connection is an ephemeral resource that is created to accommodate new incoming payments.
     *
     * A new set of credential will be generated each time this API is called.
     */
    get: operations["get-ilp-stream-connection"];
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
    };
  };
  "/incoming-payments": {
    /** List all incoming payments on the payment pointer */
    get: operations["list-incoming-payments"];
    /**
     * A client MUST create an **incoming payment** resource before it is possible to send any payments to the payment pointer.
     *
     * All of the input parameters are _optional_.
     */
    post: operations["create-incoming-payment"];
  };
  /** Create a new outgoing payment at the payment pointer. */
  "/outgoing-payments": {
    /** List all outgoing payments on the payment pointer */
    get: operations["list-outgoing-payments"];
    /** An **outgoing payment** is a sub-resource of a payment pointer. It represents a payment from the payment pointer. */
    post: operations["create-outgoing-payment"];
  };
  /** Create a new quote at the payment pointer. */
  "/quotes": {
    /** A **quote** is a sub-resource of a payment pointer. It represents a quote for a payment from the payment pointer. */
    post: operations["create-quote"];
  };
  "/incoming-payments/{id}": {
    /** A client can fetch the latest state of an incoming payment to determine the amount received into the payment pointer. */
    get: operations["get-incoming-payment"];
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
    };
  };
  "/incoming-payments/{id}/complete": {
    /**
     * A client with the appropriate permissions MAY mark a non-expired **incoming payment** as `completed` if it has not yet received `incomingAmount`.
     *
     * This indicates to the receiving account provider that it can begin any post processing of the payment such as generating account statements or notifying the account holder of the completed payment.
     */
    post: operations["complete-incoming-payment"];
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
    };
  };
  "/outgoing-payments/{id}": {
    /** A client can fetch the latest state of an outgoing payment. */
    get: operations["get-outgoing-payment"];
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
    };
  };
  "/quotes/{id}": {
    /** A client can fetch the latest state of a quote. */
    get: operations["get-quote"];
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
    };
  };
}

export interface components {
  schemas: {
    /**
     * Payment Pointer
     * @description A **payment pointer** resource is the root of the API and contains the public details of the financial account represented by the Payment Pointer that is also the service endpoint URL.
     */
    "payment-pointer": {
      /**
       * Format: uri
       * @description The URL identifying the incoming payment.
       */
      id: string;
      /** @description A public name for the account. This should be set by the account holder with their provider to provide a hint to counterparties as to the identity of the account holder. */
      publicName?: string;
      /** @description The asset code of the account. */
      assetCode: components["schemas"]["assetCode"];
      assetScale: components["schemas"]["assetScale"];
      /**
       * Format: uri
       * @description The URL of the authorization server endpoint for getting grants and access tokens for this payment pointer.
       */
      authServer: string;
    };
    /**
     * ILP Stream Connection
     * @description An **ILP STREAM Connection** is an endpoint that returns unique STREAM connection credentials to establish a STREAM connection to the underlying account.
     */
    "ilp-stream-connection": {
      /**
       * Format: uri
       * @description The URL identifying the endpoint.
       */
      id: string;
      /** @description The ILP address to use when establishing a STREAM connection. */
      ilpAddress: string;
      /** @description The base64 url-encoded shared secret to use when establishing a STREAM connection. */
      sharedSecret: string;
      /** @description The asset code of the amount. */
      assetCode: components["schemas"]["assetCode"];
      /** @description The scale of the amount. */
      assetScale: components["schemas"]["assetScale"];
    };
    /**
     * Incoming Payment
     * @description An **incoming payment** resource represents a payment that will be, is currently being, or has been received by the account.
     */
    "incoming-payment": {
      /**
       * Format: uri
       * @description The URL identifying the incoming payment.
       */
      id: string;
      /**
       * Format: uri
       * @description The URL of the payment pointer this payment is being made into.
       */
      paymentPointer: string;
      /** @description Describes whether the incoming payment has completed receiving fund. */
      completed: boolean;
      /** @description The maximum amount that should be paid into the payment pointer under this incoming payment. */
      incomingAmount?: components["schemas"]["amount"];
      /** @description The total amount that has been paid into the payment pointer under this incoming payment. */
      receivedAmount: components["schemas"]["amount"];
      /**
       * Format: date-time
       * @description The date and time when payments under this incoming payment will no longer be accepted.
       */
      expiresAt?: string;
      /** @description Human readable description of the incoming payment that will be visible to the account holder. */
      description?: string;
      /** @description A reference that can be used by external systems to reconcile this payment with their systems. E.g. An invoice number. */
      externalRef?: string;
      /**
       * Format: date-time
       * @description The date and time when the incoming payment was created.
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description The date and time when the incoming payment was updated.
       */
      updatedAt: string;
    };
    /**
     * Incoming Payment with Connection
     * @description An **incoming payment** resource with the Interledger STREAM Connection to use to pay into the payment pointer under this incoming payment.
     */
    "incoming-payment-with-connection": components["schemas"]["incoming-payment"] & {
      ilpStreamConnection?: components["schemas"]["ilp-stream-connection"];
    };
    /**
     * Incoming Payment with Connection
     * @description An **incoming payment** resource with the url for the Interledger STREAM Connection resource to use to pay into the payment pointer under this incoming payment.
     */
    "incoming-payment-with-connection-url": components["schemas"]["incoming-payment"] & {
      /**
       * Format: uri
       * @description Endpoint that returns unique STREAM connection credentials to establish a STREAM connection to the underlying account.
       */
      ilpStreamConnection?: string;
    };
    /**
     * Outgoing Payment
     * @description An **outgoing payment** resource represents a payment that will be, is currently being, or has previously been, sent from the payment pointer.
     */
    "outgoing-payment": {
      /**
       * Format: uri
       * @description The URL identifying the outgoing payment.
       */
      id: string;
      /**
       * Format: uri
       * @description The URL of the payment pointer from which this payment is sent.
       */
      paymentPointer: string;
      /**
       * Format: uri
       * @description The URL of the quote defining this payment's amounts.
       */
      quoteId?: string;
      /** @description Describes whether the payment failed to send its full amount. */
      failed?: boolean;
      /** @description The URL of the incoming payment or ILP STREAM Connection that is being paid. */
      receiver: components["schemas"]["receiver"];
      /** @description The total amount that should be received by the receiver when this outgoing payment has been paid. */
      receiveAmount: components["schemas"]["amount"];
      /** @description The total amount that should be sent when this outgoing payment has been paid. */
      sendAmount: components["schemas"]["amount"];
      /** @description The total amount that has been sent under this outgoing payment. */
      sentAmount: components["schemas"]["amount"];
      /** @description Human readable description of the outgoing payment that will be visible to the account holder and shared with the receiver. */
      description?: string;
      /** @description A reference that can be used by external systems to reconcile this payment with their systems. E.g. An invoice number. (Optional) */
      externalRef?: string;
      /**
       * Format: date-time
       * @description The date and time when the outgoing payment was created.
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description The date and time when the outgoing payment was updated.
       */
      updatedAt: string;
    };
    /**
     * Quote
     * @description A **quote** resource represents the quoted amount details with which an Outgoing Payment may be created.
     */
    quote: {
      /**
       * Format: uri
       * @description The URL identifying the quote.
       */
      id: string;
      /**
       * Format: uri
       * @description The URL of the payment pointer from which this quote's payment would be sent.
       */
      paymentPointer: string;
      /** @description The URL of the incoming payment or ILP Stream Connection that would be paid. */
      receiver: components["schemas"]["receiver"];
      /** @description The total amount that should be received by the receiver. */
      receiveAmount: components["schemas"]["amount"];
      /** @description The total amount that should be sent by the sender. */
      sendAmount: components["schemas"]["amount"];
      /** @description The date and time when the calculated `sendAmount` is no longer valid. */
      expiresAt?: string;
      /**
       * Format: date-time
       * @description The date and time when the quote was created.
       */
      createdAt: string;
    };
    /**
     * Amount
     * @description All amounts in open payments are represented as a value and an asset code and scale.
     *
     * The `value` is an unsigned 64-bit integer amount, represented as a string.
     *
     * The `assetCode` is a code that indicates the underlying asset. In most cases this SHOULD be a 3-character ISO 4217 currency code.
     *
     * The `assetScale` indicates how the `value` has been scaled relative to the natural scale of the asset. For example, an `value` of `"1234"` with an `assetScale` of `2` represents an amount of 12.34.
     */
    amount: {
      /**
       * Format: uint64
       * @description The amount, scaled by the given scale.
       */
      value: string;
      /** @description The asset code of the amount. */
      assetCode: components["schemas"]["assetCode"];
      /** @description The scale of the amount. */
      assetScale: components["schemas"]["assetScale"];
    };
    /**
     * Asset code
     * @description This SHOULD be an ISO4217 currency code.
     */
    assetCode: string;
    /**
     * Asset scale
     * @description The scale of amounts denoted in the corresponding asset code.
     */
    assetScale: number;
    /**
     * Receiver
     * Format: uri
     * @description The URL of the incoming payment or ILP STREAM connection that is being paid.
     */
    receiver: string;
    /** @description Pagination parameters */
    pagination:
      | components["schemas"]["forward-pagination"]
      | components["schemas"]["backward-pagination"];
    /** @description Forward pagination parameters */
    "forward-pagination": {
      /** @description The number of items to return. */
      first?: number;
      /** @description The cursor key to list from. */
      cursor?: string;
    };
    /** @description Backward pagination parameters */
    "backward-pagination": {
      /** @description The number of items to return. */
      last?: number;
      /** @description The cursor key to list from. */
      cursor: string;
    };
    "page-info": {
      /** @description Cursor corresponding to the first element in the result array. */
      startCursor: string;
      /** @description Cursor corresponding to the last element in the result array. */
      endCursor: string;
      /** @description Describes whether the data set has further entries. */
      hasNextPage: boolean;
      /** @description Describes whether the data set has previous entries. */
      hasPreviousPage: boolean;
    };
  };
  responses: {
    /** Authorization required */
    401: unknown;
    /** Forbidden */
    403: unknown;
  };
  parameters: {
    /** @description Sub-resource identifier */
    id: string;
    /** @description The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
    signature: string;
    /** @description The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
    "signature-input": string;
  };
}

export interface operations {
  /**
   * Retrieve the public information of the Payment Pointer.
   *
   * This end-point should be open to anonymous requests as it allows clients to verify a Payment Pointer URL and get the basic information required to construct new transactions and discover the grant request URL.
   *
   * The content should be slow changing and cacheable for long periods. Servers SHOULD use cache control headers.
   */
  "get-payment-pointer": {
    responses: {
      /** Payment Pointer Found */
      200: {
        content: {
          "application/json": components["schemas"]["payment-pointer"];
        };
      };
      /** Payment Pointer Not Found */
      404: unknown;
    };
  };
  /**
   * *NB* Use server url specific to this path.
   *
   * Fetch new connection credentials for an ILP STREAM connection.
   *
   * A connection is an ephemeral resource that is created to accommodate new incoming payments.
   *
   * A new set of credential will be generated each time this API is called.
   */
  "get-ilp-stream-connection": {
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
    };
    responses: {
      /** Connection Found */
      200: {
        content: {
          "application/json": components["schemas"]["ilp-stream-connection"];
        };
      };
      /** Connection Not Found */
      404: unknown;
    };
  };
  /** List all incoming payments on the payment pointer */
  "list-incoming-payments": {
    parameters: {
      query: {
        /** Pagination parameters */
        pagination?: components["schemas"]["pagination"];
      };
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** OK */
      200: {
        content: {
          "application/json": {
            pagination?: components["schemas"]["page-info"];
            result?: components["schemas"]["incoming-payment-with-connection-url"][];
          };
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
    };
  };
  /**
   * A client MUST create an **incoming payment** resource before it is possible to send any payments to the payment pointer.
   *
   * All of the input parameters are _optional_.
   */
  "create-incoming-payment": {
    parameters: {
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** Incoming Payment Created */
      201: {
        content: {
          "application/json": components["schemas"]["incoming-payment-with-connection"];
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
    };
    /**
     * A subset of the incoming payments schema is accepted as input to create a new incoming payment.
     *
     * The `incomingAmount` must use the same `assetCode` and `assetScale` as the payment pointer.
     */
    requestBody: {
      content: {
        "application/json": {
          /** @description The maximum amount that should be paid into the payment pointer under this incoming payment. */
          incomingAmount?: components["schemas"]["amount"];
          /**
           * Format: date-time
           * @description The date and time when payments into the incoming payment must no longer be accepted.
           */
          expiresAt?: string;
          /** @description Human readable description of the incoming payment that will be visible to the account holder. */
          description?: string;
          /** @description A reference that can be used by external systems to reconcile this payment with their systems. E.g. An invoice number. (Optional) */
          externalRef?: string;
        };
      };
    };
  };
  /** List all outgoing payments on the payment pointer */
  "list-outgoing-payments": {
    parameters: {
      query: {
        /** Pagination parameters */
        pagination?: components["schemas"]["pagination"];
      };
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** OK */
      200: {
        content: {
          "application/json": {
            pagination?: components["schemas"]["page-info"];
            result?: components["schemas"]["outgoing-payment"][];
          };
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
    };
  };
  /** An **outgoing payment** is a sub-resource of a payment pointer. It represents a payment from the payment pointer. */
  "create-outgoing-payment": {
    parameters: {
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** Outgoing Payment Created */
      201: {
        content: {
          "application/json": components["schemas"]["outgoing-payment"];
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
    };
    /**
     * A subset of the outgoing payments schema is accepted as input to create a new outgoing payment.
     *
     * The `sendAmount` must use the same `assetCode` and `assetScale` as the payment pointer.
     */
    requestBody: {
      content: {
        "application/json": {
          /**
           * Format: uri
           * @description The URL of the quote defining this payment's amounts.
           */
          quoteId: string;
          /** @description Human readable description of the outgoing payment that will be visible to the account holder and shared with the receiver. */
          description?: string;
          /** @description A reference that can be used by external systems to reconcile this payment with their systems. E.g. An invoice number. (Optional) */
          externalRef?: string;
        };
      };
    };
  };
  /** A **quote** is a sub-resource of a payment pointer. It represents a quote for a payment from the payment pointer. */
  "create-quote": {
    parameters: {
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** Quote Created */
      201: {
        content: {
          "application/json": components["schemas"]["quote"];
        };
      };
      /** No amount was provided and no amount could be inferred from the receiver. */
      400: unknown;
      401: components["responses"]["401"];
      403: components["responses"]["403"];
    };
    /**
     * A subset of the quotes schema is accepted as input to create a new quote.
     *
     * The quote must be created with a (`sendAmount` xor `receiveAmount`) unless the `receiver` is an Incoming Payment which has an `incomingAmount`.
     */
    requestBody: {
      content: {
        "application/json": {
          receiver: components["schemas"]["receiver"];
          receiveAmount?: components["schemas"]["amount"];
          sendAmount?: components["schemas"]["amount"];
        };
      };
    };
  };
  /** A client can fetch the latest state of an incoming payment to determine the amount received into the payment pointer. */
  "get-incoming-payment": {
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** Incoming Payment Found */
      200: {
        content: {
          "application/json": components["schemas"]["incoming-payment-with-connection"];
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
      /** Incoming Payment Not Found */
      404: unknown;
    };
  };
  /**
   * A client with the appropriate permissions MAY mark a non-expired **incoming payment** as `completed` if it has not yet received `incomingAmount`.
   *
   * This indicates to the receiving account provider that it can begin any post processing of the payment such as generating account statements or notifying the account holder of the completed payment.
   */
  "complete-incoming-payment": {
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** OK */
      200: {
        content: {
          "application/json": components["schemas"]["incoming-payment"];
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
      /** Incoming Payment Not Found */
      404: unknown;
    };
  };
  /** A client can fetch the latest state of an outgoing payment. */
  "get-outgoing-payment": {
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** Outgoing Payment Found */
      200: {
        content: {
          "application/json": components["schemas"]["outgoing-payment"];
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
      /** Outgoing Payment Not Found */
      404: unknown;
    };
  };
  /** A client can fetch the latest state of a quote. */
  "get-quote": {
    parameters: {
      path: {
        /** Sub-resource identifier */
        id: components["parameters"]["id"];
      };
      header: {
        /** The Signature-Input field is a Dictionary structured field containing the metadata for one or more message signatures generated from components within the HTTP message.  Each member describes a single message signature.  The member's key is the label that uniquely identifies the message signature within the context of the HTTP message.  The member's value is the serialization of the covered components Inner List plus all signature metadata parameters identified by the label.  The following components MUST be included: - "@method" - "@target-uri" - "authorization" When the message contains a request body, the covered components MUST also include the following: - "content-digest"  The keyid parameter of the signature MUST be set to the kid value of the JWK.      See [ietf-httpbis-message-signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures#section-4.1) for more details. */
        "Signature-Input": components["parameters"]["signature-input"];
        /** The signature generated based on the Signature-Input, using the signing algorithm specified in the "alg" field of the JWK. */
        Signature: components["parameters"]["signature"];
      };
    };
    responses: {
      /** Quote Found */
      200: {
        content: {
          "application/json": components["schemas"]["quote"];
        };
      };
      401: components["responses"]["401"];
      403: components["responses"]["403"];
      /** Quote Not Found */
      404: unknown;
    };
  };
}

export interface external {}
