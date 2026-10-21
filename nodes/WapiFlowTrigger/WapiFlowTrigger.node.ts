import {
    type IDataObject,
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
        outputs: ['main'],
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
                    'Copy the <strong>Production URL</strong> above into WapiFlow dashboard → Instances → Webhook events. Tick the events you selected below and <strong>Save</strong>.',
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
                        name: 'Connection State (CONNECTION_UPDATE)',
                        value: 'CONNECTION_UPDATE',
                        description: 'WhatsApp connection changed state (open / connecting / close)',
                    },
                    {
                        name: 'Message Status (MESSAGES_UPDATE)',
                        value: 'MESSAGES_UPDATE',
                        description: 'A message changed delivery status (sent → delivered → read)',
                    },
                    {
                        name: 'New Message (MESSAGES_UPSERT)',
                        value: 'MESSAGES_UPSERT',
                        description: 'An inbound or outbound message arrived or was echoed',
                    },
                    {
                        name: 'Outbound Sent (SEND_MESSAGE)',
                        value: 'SEND_MESSAGE',
                        description: 'Your account sent a message (via API or Chat)',
                    },
                    {
                        name: 'QR Code Updated (QRCODE_UPDATED)',
                        value: 'QRCODE_UPDATED',
                        description: 'A new QR code is available for pairing',
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

    async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
        const body = this.getBodyData() as IDataObject;
        const allowedEvents = this.getNodeParameter('events', []) as string[];
        const inboundOnly = this.getNodeParameter('inboundOnly', true) as boolean;

        const event = String(body.event ?? '').toUpperCase();

        // Drop events the user didn't opt into
        if (allowedEvents.length > 0 && !allowedEvents.includes(event)) {
            return {
                webhookResponse: { ok: true, filtered: true, reason: 'event not subscribed' },
                workflowData: [[]],
            };
        }

        // Drop our own outbound echoes when inboundOnly is on and the event is MESSAGES_UPSERT
        if (inboundOnly && event === 'MESSAGES_UPSERT') {
            const data = (body.data ?? {}) as IDataObject;
            const key = (data.key ?? {}) as IDataObject;
            if (key.fromMe === true) {
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
