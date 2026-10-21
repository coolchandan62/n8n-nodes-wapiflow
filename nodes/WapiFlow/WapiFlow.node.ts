import {
    type INodeType,
    type INodeTypeDescription,
} from 'n8n-workflow';

/**
 * WapiFlow action node.
 *
 * Uses n8n's declarative routing API — each operation describes its HTTP call
 * via a `routing` block, so there's no imperative `execute()` method and no
 * manual HTTP plumbing. Credentials, headers, retries and error handling are
 * provided by n8n core.
 *
 * Add new operations by:
 *   1. Adding an entry to the Operation `options` of the matching resource.
 *   2. Adding its request-body/query fields with `displayOptions.show` scoped
 *      to the operation.
 *   3. Wiring the field to the HTTP body/query via `routing.send`.
 *
 * See `/api-docs.php` in your WapiFlow dashboard for the full endpoint
 * reference the operations below map to.
 */
export class WapiFlow implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'WapiFlow',
        name: 'wapiFlow',
        icon: {
            light: 'file:wapiflow.svg',
            dark: 'file:wapiflow.svg',
        },
        group: ['output'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Send WhatsApp messages and manage instances via your WapiFlow installation.',
        defaults: {
            name: 'WapiFlow',
        },
        inputs: ['main'],
        outputs: ['main'],
        usableAsTool: true,
        credentials: [
            {
                name: 'wapiFlowApi',
                required: true,
            },
        ],
        requestDefaults: {
            baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}/api/v1',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            // 15s matches the HTTP Request fallback in Phase 5 sample workflows.
            timeout: 15000,
        },
        properties: [
            // -----------------------------------------------------------------
            // Resource picker
            // -----------------------------------------------------------------
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Message',
                        value: 'message',
                    },
                    {
                        name: 'Instance',
                        value: 'instance',
                    },
                ],
                default: 'message',
            },

            // =================================================================
            // RESOURCE: Message
            // =================================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                    },
                },
                options: [
                    {
                        name: 'Send Text',
                        value: 'sendText',
                        action: 'Send a text message',
                        description: 'Send a plain-text WhatsApp message. Supports *bold*, _italic_, ~strike~ and ```mono``` formatting.',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/messages.php',
                            },
                        },
                    },
                    {
                        name: 'Send Media',
                        value: 'sendMedia',
                        action: 'Send a media message',
                        description: 'Send an image, video, audio or document from a public URL with an optional caption',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/messages.php',
                            },
                        },
                    },
                    {
                        name: 'Get Status',
                        value: 'getStatus',
                        action: 'Get delivery status',
                        description: 'Look up the delivery status of a previously sent message',
                        routing: {
                            request: {
                                method: 'GET',
                                url: '=/message-status.php?id={{$parameter["messageId"]}}',
                            },
                        },
                    },
                ],
                default: 'sendText',
            },

            // ---- Send Text / Send Media shared field: To ----
            {
                displayName: 'To',
                name: 'to',
                type: 'string',
                required: true,
                default: '',
                placeholder: '919876543210',
                description:
                    'Destination phone number with country code (digits only). Example: 919876543210. Indian 10-digit mobiles get the 91 prefix added automatically.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendText', 'sendMedia'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'to',
                    },
                },
            },

            // ---- Send Text: Message ----
            {
                displayName: 'Message',
                name: 'message',
                type: 'string',
                required: true,
                default: '',
                typeOptions: {
                    rows: 4,
                },
                description:
                    'The text to send. Supports *bold*, _italic_, ~strike~ and ```mono``` formatting.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendText'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'message',
                    },
                },
            },

            // ---- Send Media: Media URL ----
            {
                displayName: 'Media URL',
                name: 'mediaUrl',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'https://example.com/brochure.pdf',
                description:
                    'Public http(s) URL of the file. WapiFlow will download it, infer the mime type and deliver it to WhatsApp.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendMedia'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'media_url',
                    },
                },
            },

            // ---- Send Media: Caption ----
            {
                displayName: 'Caption',
                name: 'caption',
                type: 'string',
                default: '',
                typeOptions: {
                    rows: 2,
                },
                description:
                    'Optional caption shown with the media. For documents, it appears above the preview.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendMedia'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'message',
                    },
                },
            },

            // ---- Send Media: Media Type (optional override) ----
            {
                displayName: 'Media Type',
                name: 'mediaType',
                type: 'options',
                default: 'auto',
                description:
                    'How the media is delivered. "Auto-detect" infers from the mime type (recommended).',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendMedia'],
                    },
                },
                options: [
                    { name: 'Audio', value: 'audio' },
                    { name: 'Auto-Detect', value: 'auto' },
                    { name: 'Document', value: 'document' },
                    { name: 'Image', value: 'image' },
                    { name: 'Video', value: 'video' },
                ],
                routing: {
                    send: {
                        type: 'body',
                        property: 'type',
                        // Only send the field when the user picked an explicit type;
                        // "auto" lets WapiFlow infer from the mime type instead.
                        value: '={{ $value === "auto" ? undefined : $value }}',
                    },
                },
            },

            // ---- Get Status: Message ID ----
            {
                displayName: 'Message ID',
                name: 'messageId',
                type: 'number',
                required: true,
                default: 0,
                description: 'The numeric message_id returned by a previous Send Text / Send Media response',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['getStatus'],
                    },
                },
            },

            // =================================================================
            // RESOURCE: Instance
            // =================================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: ['instance'],
                    },
                },
                options: [
                    {
                        name: 'Verify Credentials',
                        value: 'me',
                        action: 'Verify API credentials',
                        description:
                            'Validates the API key and returns the WhatsApp instance it is bound to. Useful for debugging.',
                        routing: {
                            request: {
                                method: 'GET',
                                url: '/me.php',
                            },
                        },
                    },
                    {
                        name: 'List',
                        value: 'list',
                        action: 'List instances',
                        description: 'Lists all WhatsApp instances in the current tenant with connection status',
                        routing: {
                            request: {
                                method: 'GET',
                                url: '/instances.php',
                            },
                        },
                    },
                ],
                default: 'me',
            },
        ],
    };
}
