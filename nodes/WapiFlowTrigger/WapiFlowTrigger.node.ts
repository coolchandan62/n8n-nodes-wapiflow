import {
    NodeConnectionTypes,
    type IDataObject,
    type IHookFunctions,
    type INodeType,
    type INodeTypeDescription,
    type IWebhookFunctions,
    type IWebhookResponseData,
} from 'n8n-workflow';

/**
 * WapiFlow trigger node.
 *
 * n8n hosts a public webhook URL for this node. The user pastes that URL
 * into WapiFlow dashboard → Instances → Webhook events, picks the matching
 * events, and WapiFlow (via Evolution) starts POSTing WhatsApp events to it
 * in real time.
 *
 * We don't programmatically register the webhook with WapiFlow in V0.1 —
 * tenant admins configure that in the dashboard. V2 can add a lifecycle
 * `create`/`delete` to do it automatically via the REST API.
 *
 * The node applies an in-process event filter so a single workflow doesn't
 * get flooded with every event type when the user only cares about new
 * inbound messages.
 */
export class WapiFlowTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'WapiFlow Trigger',
        name: 'wapiFlowTrigger',
        icon: {
            light: 'file:wapiflow.svg',
            dark: 'file:wapiflow.svg',
        },
        group: ['trigger'],
        version: 1,
        subtitle: 'Receive WhatsApp events',
        description: 'Starts a workflow when WapiFlow receives a WhatsApp event (new message, status update, etc.).',
        defaults: {
            name: 'WapiFlow Trigger',
        },
        inputs: [],
        outputs: [NodeConnectionTypes.Main],
        // Credentials are optional for the trigger node — the webhook URL is
        // the auth boundary. Keep it visible so users can still mark the
        // workflow as "WapiFlow-related" in their credentials picker.
        credentials: [
            {
                name: 'wapiFlowApi',
                required: false,
            },
        ],
        webhooks: [
            {
                name: 'default',
                httpMethod: 'POST',
                responseMode: 'onReceived',
                path: 'wapiflow',
            },
        ],
        properties: [
            {
                displayName:
                    'For active workflows, copy the <strong>Production URL</strong> above into WapiFlow dashboard -> Instances -> Webhook events. When testing via "Listen for Test Event", copy the <strong>Test URL</strong> instead. Tick the events you selected below and <strong>Save</strong>.',
                name: 'setupNotice',
                type: 'notice',
                default: '',
            },
            {
                displayName: 'Events',
                name: 'events',
                type: 'multiOptions',
                default: ['MESSAGES_UPSERT'],
                description:
                    'Which WapiFlow events this workflow should react to. Other events will still hit the webhook but are dropped silently.',
                options: [
                    {
                        name: 'Connection State Changed',
                        value: 'CONNECTION_UPDATE',
                        description: 'Triggers when WhatsApp connection changes state (open, connecting, close)',
                    },
                    {
                        name: 'Message Sent (Outbound)',
                        value: 'SEND_MESSAGE',
                        description: 'Triggers when a message is sent from your instance (via API or chat)',
                    },
                    {
                        name: 'Message Status Changed',
                        value: 'MESSAGES_UPDATE',
                        description: 'Triggers when a message changes delivery status (sent, delivered, read)',
                    },
                    {
                        name: 'New Message Received',
                        value: 'MESSAGES_UPSERT',
                        description: 'Triggers when a new WhatsApp message is received or echoed',
                    },
                    {
                        name: 'QR Code Updated',
                        value: 'QRCODE_UPDATED',
                        description: 'Triggers when a new QR code is available for device pairing',
                    },
                ],
            },
            {
                displayName: 'Inbound Only',
                name: 'inboundOnly',
                type: 'boolean',
                default: true,
                description:
                    'Whether to drop messages the account sent itself (fromMe=true). Keep on to react only to what contacts write to you.',
            },
        ],
    };

    webhookMethods = {
        default: {
            async checkExists(this: IHookFunctions): Promise<boolean> {
                return true;
            },
            async create(this: IHookFunctions): Promise<boolean> {
                return true;
            },
            async delete(this: IHookFunctions): Promise<boolean> {
                return true;
            },
        },
    };

    async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
        const body = (this.getBodyData() ?? {}) as IDataObject;
        const allowedEvents = (this.getNodeParameter('events', []) as string[]).map((e) =>
            e.toUpperCase().replace(/[.-]/g, '_').trim(),
        );
        const inboundOnly = this.getNodeParameter('inboundOnly', true) as boolean;

        const rawEvent = String(body.event ?? body.type ?? '').trim();
        const event = rawEvent.toUpperCase().replace(/[.-]/g, '_').trim();

        // Drop events the user didn't opt into
        if (event && allowedEvents.length > 0 && !allowedEvents.includes(event)) {
            return {
                webhookResponse: { ok: true, filtered: true, reason: 'event not subscribed' },
                workflowData: [[]],
            };
        }

        // Drop our own outbound echoes when inboundOnly is on and the event is MESSAGES_UPSERT
        if (inboundOnly && (event === 'MESSAGES_UPSERT' || !event)) {
            const rawData = body.data;
            const data = (Array.isArray(rawData) ? rawData[0] : rawData ?? {}) as IDataObject;
            const key = (data.key ?? {}) as IDataObject;
            if (key.fromMe === true || body.fromMe === true || data.fromMe === true) {
                return {
                    webhookResponse: { ok: true, filtered: true, reason: 'fromMe=true' },
                    workflowData: [[]],
                };
            }
        }

        return {
            webhookResponse: { ok: true },
            workflowData: [this.helpers.returnJsonArray(body)],
        };
    }
}
