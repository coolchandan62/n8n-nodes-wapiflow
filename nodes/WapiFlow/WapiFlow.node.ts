import {
    NodeConnectionTypes,
    type IExecuteSingleFunctions,
    type IHttpRequestOptions,
    type INodeExecutionData,
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

async function postReceiveDecryptMedia(
    this: IExecuteSingleFunctions,
    items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
    for (const item of items) {
        const json = (item.json ?? {}) as Record<string, unknown>;
        const payload =
            json.data && typeof json.data === 'object'
                ? (json.data as Record<string, unknown>)
                : json;
        const base64 = String(payload.base64 ?? '');
        if (base64 === '') {
            continue;
        }
        const filename = String(payload.filename ?? 'file');
        const mime = String(payload.mime ?? 'application/octet-stream');
        item.binary = {
            ...(item.binary ?? {}),
            data: await this.helpers.prepareBinaryData(Buffer.from(base64, 'base64'), filename, mime),
        };
    }
    return items;
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
        icon: 'file:wapiflow.svg',
        group: ['output'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description:
            'Send WhatsApp text, media, buttons, polls, location and contacts, decrypt inbound media, and check instance status via your WapiFlow installation.',
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
                description: 'Message = send or decrypt WhatsApp content. Instance = credentials and session list.',
                options: [
                    {
                        name: 'Instance',
                        value: 'instance',
                        description: 'Check API credentials and list WhatsApp instances',
                    },
                    {
                        name: 'Message',
                        value: 'message',
                        description:
                            'Send WhatsApp messages or decrypt a received voice note / image / video / document',
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
                description:
                    'What to do. Send Text/Media are saved in the inbox. Buttons, poll, location and contact go to WhatsApp only. Decrypt Media turns an inbound voice/image into a file.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                    },
                },
                options: [
                    {
                        name: 'Decrypt Media',
                        value: 'decryptMedia',
                        action: 'Decrypt inbound media',
                        description:
                            'Download a received voice note, image, video or document as a file. Use this instead of the encrypted WhatsApp URL from the webhook.',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/media.php',
                                timeout: 30000,
                            },
                            output: {
                                postReceive: [postReceiveDecryptMedia],
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
            {
                displayName:
                    '<strong>Send Text</strong> stores the message in your WapiFlow inbox. Use expressions like <code>{{$json.senderPhone}}</code> from a WapiFlow Trigger. Formatting: *bold* _italic_ ~strike~ ```mono```.',
                name: 'helpSendText',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
            },
            {
                displayName:
                    '<strong>Send Media</strong> needs a public http(s) URL (Google Drive / Dropbox direct links often fail). WapiFlow downloads the file and sends it. Stored in the inbox. For inbound files use <strong>Decrypt Media</strong> — do not re-send the encrypted WhatsApp URL.',
                name: 'helpSendMedia',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
            },
            {
                displayName:
                    '<strong>Send Buttons</strong> — max 3 quick-reply buttons. When the user taps one, the Trigger receives <code>buttonsResponseMessage</code>; branch on the button <strong>ID</strong>. Not stored in the WapiFlow chat inbox.',
                name: 'helpSendButtons',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['sendButtons'] } },
            },
            {
                displayName:
                    '<strong>Send Location</strong> drops a map pin. WhatsApp requires both <strong>Place Name</strong> and <strong>Address</strong> or the send fails. Not stored in the WapiFlow inbox.',
                name: 'helpSendLocation',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
            },
            {
                displayName:
                    '<strong>Send Contact</strong> shares a vCard. <strong>WhatsApp Number</strong> must be digits with country code (e.g. 919876543210). Display Number is optional formatting. Not stored in the WapiFlow inbox.',
                name: 'helpSendContact',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
            },
            {
                displayName:
                    '<strong>Send Poll</strong> needs 2-12 choices. Answers arrive on the Trigger as <code>pollUpdateMessage</code>. Not stored in the WapiFlow inbox.',
                name: 'helpSendPoll',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
            },
            {
                displayName:
                    '<strong>Get Status</strong> only tracks <strong>Send Text</strong> / <strong>Send Media</strong> (they return <code>message_id</code>). Button, poll, location and contact sends have no inbox status row.',
                name: 'helpGetStatus',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['message'], operation: ['getStatus'] } },
            },

            // ---- Send Text / Send Media shared field: To ----
            {
                displayName: 'To',
                name: 'to',
                type: 'string',
                required: true,
                default: '',
                placeholder: '919876543210',
                description: 'Recipient WhatsApp number, digits only with country code (e.g. 919876543210). Indian 10-digit mobiles get 91 added automatically. From a Trigger use {{$JSON.senderPhone}}.',
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
                description: 'Recipient WhatsApp number, digits only with country code (e.g. 919876543210). Indian 10-digit mobiles get 91 added automatically. From a Trigger use {{$JSON.senderPhone}}.',
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
                description: 'Message body shown in WhatsApp. Supports *bold*, _italic_, ~strike~ and ```mono```. From a Trigger you can reply with {{$JSON.messageText}}.',
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
                    'Public http(s) URL WapiFlow can download (must not require login). PDF, JPG, PNG, MP4, MP3, OGG work best. Do not paste mmg.whatsapp.net encrypted URLs.',
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
                    'Optional text shown with the file. On documents it appears above the preview. Leave blank for media-only.',
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
                    'How WhatsApp should render the file. Leave Auto-Detect unless the URL has a wrong or missing file extension.',
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
                description: 'Bold header on the button card (e.g. Confirm your appointment)',
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
                description: 'Optional body under the title (date, amount, short instructions)',
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
                description: 'Optional small footer (business name). WhatsApp shows it under the buttons.',
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
                description:
                    'Add 1-3 buttons. Label is what the user sees; ID is what your workflow receives when they tap. Empty ID becomes a slug of the label (Confirm → confirm).',
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
                                description:
                                    'Stable key for IF nodes (e.g. btn_confirm). Keep it unique. Leave blank to auto-generate from the label.',
                            },
                            {
                                displayName: 'Label',
                                name: 'displayText',
                                type: 'string',
                                default: '',
                                placeholder: 'Confirm',
                                description: 'Short label on the button (WhatsApp truncates long text)',
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
                description: 'Pin latitude in decimal degrees, e.g. 28.6139 for New Delhi. Range -90 to 90.',
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
                description: 'Pin longitude in decimal degrees, e.g. 77.2090 for New Delhi. Range -180 to 180.',
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
                description: 'Title on the pin (shop / office name). Required by WhatsApp — empty name fails the send.',
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
                description: 'Street / area shown under the title. Required by WhatsApp — empty address fails the send.',
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
                description:
                    'One or more contact cards. WhatsApp Number = digits with country code. Full Name is what the recipient sees.',
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
                                description: 'Pretty number on the card (e.g. +91 90138 41418). Blank = WhatsApp Number.',
                            },
                            {
                                displayName: 'Full Name',
                                name: 'fullName',
                                type: 'string',
                                default: '',
                                placeholder: 'Chandan Singh',
                                description: 'Name shown on the contact card (required)',
                            },
                            {
                                displayName: 'WhatsApp Number',
                                name: 'wuid',
                                type: 'string',
                                default: '',
                                placeholder: '919013841418',
                                description: 'WhatsApp ID, digits only (e.g. 919013841418). Spaces and + are stripped.',
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
                description: 'Question shown at the top of the poll (e.g. Which delivery slot works for you?)',
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
                description: 'Add 2-12 answer rows. WhatsApp rejects polls with fewer than 2 choices.',
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
                                description: 'One option the recipient can vote for',
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
                description: 'How many options one voter can pick. Use 1 for single-choice polls.',
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

            // ---- Decrypt Media ----
            {
                displayName:
                    '<strong>Decrypt Media</strong> — do not download <code>audioMessage.url</code> (it is encrypted). After a Trigger, set Lookup to WhatsApp Message ID and map <code>data.key.ID</code>. Output: binary <code>data</code> (Write Binary File) plus JSON base64. Chat copies stay on the server until Media retention.',
                name: 'decryptNotice',
                type: 'notice',
                default: '',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['decryptMedia'],
                    },
                },
            },
            {
                displayName: 'Lookup',
                name: 'mediaLookup',
                type: 'options',
                default: 'provider',
                description:
                    'WhatsApp Message ID is easiest from the Trigger (data.key.ID). Use WapiFlow Message ID only if you already stored the row in the inbox.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['decryptMedia'],
                    },
                },
                options: [
                    {
                        name: 'WapiFlow Message ID',
                        value: 'wapi',
                        description: 'Numeric ID from the WapiFlow messages table',
                    },
                    {
                        name: 'WhatsApp Message ID',
                        value: 'provider',
                        description: 'Data.key.ID from the inbound webhook (recommended)',
                    },
                ],
            },
            {
                displayName: 'WhatsApp Message ID',
                name: 'providerMessageId',
                type: 'string',
                required: true,
                default: '',
                placeholder: '3EB0C43F64FDB1FA5E20',
                description:
                    'WhatsApp Message ID from the webhook payload (data.key.ID). Required unless you use WapiFlow Message ID.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['decryptMedia'],
                        mediaLookup: ['provider'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'provider_message_id',
                    },
                },
            },
            {
                displayName: 'WapiFlow Message ID',
                name: 'decryptMessageId',
                type: 'number',
                required: true,
                default: 0,
                description:
                    'Inbox row ID after WapiFlow stored the inbound media. Use this if you do not have the WhatsApp Message ID.',
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['decryptMedia'],
                        mediaLookup: ['wapi'],
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'message_id',
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
                description:
                    'Numeric message_id from a previous Send Text or Send Media output (data.message_id). Not used for buttons/polls.',
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
            {
                displayName:
                    '<strong>Verify Credentials</strong> calls <code>/me.php</code> — same as the credential Test button. Use it to confirm the key is bound to a connected instance before sending.',
                name: 'helpInstanceMe',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['instance'], operation: ['me'] } },
            },
            {
                displayName:
                    '<strong>List</strong> returns every WhatsApp instance on the tenant (<code>connection_status</code>: connected / connecting / disconnected). Your API key still sends only through the instance it is bound to.',
                name: 'helpInstanceList',
                type: 'notice',
                default: '',
                displayOptions: { show: { resource: ['instance'], operation: ['list'] } },
            },
        ],
    };
}
