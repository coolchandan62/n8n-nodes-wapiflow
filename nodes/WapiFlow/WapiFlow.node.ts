import {
    NodeConnectionTypes,
    type IExecuteSingleFunctions,
    type IHttpRequestOptions,
    type INodeType,
    type INodeTypeDescription,
} from 'n8n-workflow';

type ButtonRow = { displayText?: string; id?: string };
type ContactRow = { fullName?: string; wuid?: string; phoneNumber?: string };
type PollOptionRow = { value?: string };

function slugId(label: string): string {
    return label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
}

async function preSendButtons(
    this: IExecuteSingleFunctions,
    requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
    const ui = this.getNodeParameter('buttonsUi', { button: [] }) as { button?: ButtonRow[] };
    const body = (typeof requestOptions.body === 'object' && requestOptions.body !== null
        ? requestOptions.body
        : {}) as Record<string, unknown>;
    body.buttons = (ui.button ?? [])
        .map((row) => {
            const displayText = String(row.displayText ?? '').trim();
            const id = String(row.id ?? '').trim() || slugId(displayText);
            return { type: 'reply', displayText, id };
        })
        .filter((row) => row.displayText !== '')
        .slice(0, 3);
    requestOptions.body = body;
    return requestOptions;
}

async function preSendContacts(
    this: IExecuteSingleFunctions,
    requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
    const ui = this.getNodeParameter('contactsUi', { contact: [] }) as { contact?: ContactRow[] };
    const body = (typeof requestOptions.body === 'object' && requestOptions.body !== null
        ? requestOptions.body
        : {}) as Record<string, unknown>;
    body.contact = (ui.contact ?? [])
        .map((row) => {
            const fullName = String(row.fullName ?? '').trim();
            const wuid = String(row.wuid ?? '').replace(/\D+/g, '');
            const phoneNumber = String(row.phoneNumber ?? '').trim() || wuid;
            return { fullName, wuid, phoneNumber };
        })
        .filter((row) => row.fullName !== '' && row.wuid !== '');
    requestOptions.body = body;
    return requestOptions;
}

async function preSendPoll(
    this: IExecuteSingleFunctions,
    requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
    const ui = this.getNodeParameter('pollOptionsUi', { option: [] }) as { option?: PollOptionRow[] };
    const body = (typeof requestOptions.body === 'object' && requestOptions.body !== null
        ? requestOptions.body
        : {}) as Record<string, unknown>;
    body.values = (ui.option ?? [])
        .map((row) => String(row.value ?? '').trim())
        .filter((value) => value !== '')
        .slice(0, 12);
    requestOptions.body = body;
    return requestOptions;
}

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
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,
        credentials: [
            {
                name: 'wapiFlowApi',
                required: true,
            },
        ],
        requestDefaults: {
            baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "").replace(/\\/api\\/v1$/, "")}}/api/v1',
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
                    {
                        name: 'Send Buttons',
                        value: 'sendButtons',
                        action: 'Send a buttons message',
                        description: 'Send up to 3 quick-reply buttons (Confirm / Reschedule style choices)',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/whatsapp/sendButtons.php',
                            },
                            send: {
                                preSend: [preSendButtons],
                            },
                        },
                    },
                    {
                        name: 'Send Contact',
                        value: 'sendContact',
                        action: 'Send a contact card',
                        description: 'Share one or more WhatsApp contact cards',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/whatsapp/sendContact.php',
                            },
                            send: {
                                preSend: [preSendContacts],
                            },
                        },
                    },
                    {
                        name: 'Send Location',
                        value: 'sendLocation',
                        action: 'Send a location pin',
                        description: 'Send a map pin with place name and address',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/whatsapp/sendLocation.php',
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
                        name: 'Send Poll',
                        value: 'sendPoll',
                        action: 'Send a poll',
                        description: 'Send a poll with 2-12 answer choices',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/whatsapp/sendPoll.php',
                            },
                            send: {
                                preSend: [preSendPoll],
                            },
                        },
                    },
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

            // ---- WhatsApp interactive sends: To (Evolution field is "number") ----
            {
                displayName: 'To',
                name: 'number',
                type: 'string',
                required: true,
                default: '',
                placeholder: '919876543210',
                description:
                    'Destination phone number with country code (digits only). Example: 919876543210. Indian 10-digit mobiles get the 91 prefix added automatically.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendButtons', 'sendContact', 'sendLocation', 'sendPoll'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'number',
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

            // ---- Send Buttons ----
            {
                displayName: 'Title',
                name: 'buttonTitle',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'Confirm your appointment',
                description: 'Header title shown above the buttons',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendButtons'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'title',
                    },
                },
            },
            {
                displayName: 'Description',
                name: 'buttonDescription',
                type: 'string',
                default: '',
                typeOptions: {
                    rows: 2,
                },
                description: 'Optional body text under the title',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendButtons'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'description',
                    },
                },
            },
            {
                displayName: 'Footer',
                name: 'buttonFooter',
                type: 'string',
                default: '',
                description: 'Optional small footer line at the bottom',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendButtons'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'footer',
                    },
                },
            },
            {
                displayName: 'Buttons',
                name: 'buttonsUi',
                placeholder: 'Add Button',
                type: 'fixedCollection',
                default: {},
                typeOptions: {
                    multipleValues: true,
                },
                description: 'Up to 3 quick-reply buttons. Each tap returns the button ID to your webhook.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendButtons'],
                    },
                },
                options: [
                    {
                        name: 'button',
                        displayName: 'Button',
                        values: [
                            {
                                displayName: 'ID',
                                name: 'id',
                                type: 'string',
                                default: '',
                                placeholder: 'btn_confirm',
                                description: 'Value returned when the user taps this button. Leave blank to generate from the label.',
                            },
                            {
                                displayName: 'Label',
                                name: 'displayText',
                                type: 'string',
                                default: '',
                                placeholder: 'Confirm',
                                description: 'Text shown on the button',
                            },
                        ],
                    },
                ],
            },

            // ---- Send Location ----
            {
                displayName: 'Latitude',
                name: 'latitude',
                type: 'number',
                required: true,
                default: 0,
                description: 'GPS latitude of the pin in decimal degrees (-90 to 90)',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendLocation'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'latitude',
                    },
                },
            },
            {
                displayName: 'Longitude',
                name: 'longitude',
                type: 'number',
                required: true,
                default: 0,
                description: 'GPS longitude of the pin in decimal degrees (-180 to 180)',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendLocation'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'longitude',
                    },
                },
            },
            {
                displayName: 'Place Name',
                name: 'locationName',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'WapiFlow Office',
                description: 'Place name shown as the pin title. WhatsApp requires it.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendLocation'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'name',
                    },
                },
            },
            {
                displayName: 'Address',
                name: 'locationAddress',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'Connaught Place, New Delhi',
                description: 'Address line shown under the place name. WhatsApp requires it.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendLocation'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'address',
                    },
                },
            },

            // ---- Send Contact ----
            {
                displayName: 'Contacts',
                name: 'contactsUi',
                placeholder: 'Add Contact',
                type: 'fixedCollection',
                default: {},
                typeOptions: {
                    multipleValues: true,
                },
                description: 'Contact card(s) to share. WhatsApp number is digits only.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendContact'],
                    },
                },
                options: [
                    {
                        name: 'contact',
                        displayName: 'Contact',
                        values: [
                            {
                                displayName: 'Display Number',
                                name: 'phoneNumber',
                                type: 'string',
                                default: '',
                                placeholder: '+91 90138 41418',
                                description: 'Formatted number shown on the card. Defaults to the WhatsApp number when blank.',
                            },
                            {
                                displayName: 'Full Name',
                                name: 'fullName',
                                type: 'string',
                                default: '',
                                placeholder: 'Chandan Singh',
                                description: 'Display name on the contact card',
                            },
                            {
                                displayName: 'WhatsApp Number',
                                name: 'wuid',
                                type: 'string',
                                default: '',
                                placeholder: '919013841418',
                                description: 'WhatsApp number, digits only with country code',
                            },
                        ],
                    },
                ],
            },

            // ---- Send Poll ----
            {
                displayName: 'Question',
                name: 'pollName',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'Which delivery slot works for you?',
                description: 'The poll question shown at the top',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendPoll'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'name',
                    },
                },
            },
            {
                displayName: 'Choices',
                name: 'pollOptionsUi',
                placeholder: 'Add Choice',
                type: 'fixedCollection',
                default: {},
                typeOptions: {
                    multipleValues: true,
                },
                description: 'Poll answer choices (2-12). Voters pick from these.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendPoll'],
                    },
                },
                options: [
                    {
                        name: 'option',
                        displayName: 'Choice',
                        values: [
                            {
                                displayName: 'Choice',
                                name: 'value',
                                type: 'string',
                                default: '',
                                placeholder: 'Morning 9-12',
                                description: 'One answer choice',
                            },
                        ],
                    },
                ],
            },
            {
                displayName: 'Selectable Count',
                name: 'selectableCount',
                type: 'number',
                default: 1,
                typeOptions: {
                    minValue: 1,
                    maxValue: 12,
                },
                description: 'How many choices a voter may select at once',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['sendPoll'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'selectableCount',
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
