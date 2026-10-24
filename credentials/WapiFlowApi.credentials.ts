import type {
    Icon,
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

/**
 * WapiFlow API credential — tenant-scoped API key + secret bound to one
 * WhatsApp instance. The key is minted in the WapiFlow dashboard under
 * Developer → API Keys. Secrets are stored encrypted by n8n and never
 * exposed in workflow JSON exports.
 */
export class WapiFlowApi implements ICredentialType {
    name = 'wapiFlowApi';

    displayName = 'WapiFlow API';

    icon: Icon = {
        light: 'file:wapiflow.svg',
        dark: 'file:wapiflow.svg',
    };

    documentationUrl = 'https://wapiflow.com/docs/n8n#credentials';

    properties: INodeProperties[] = [
        {
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: 'https://wapiflow.webdescent.com',
            placeholder: 'https://wapiflow.webdescent.com',
            description:
                'Your WapiFlow site URL only — no /api/v1 and no trailing slash. Example: https://wapiflow.yoursite.com. The node appends /api/v1 automatically.',
            required: true,
        },
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            placeholder: 'wf_live_xxxxxxxxxxxx',
            description:
                'From WapiFlow → Developer → API Keys. Each key is locked to one WhatsApp instance — that is the number this node will send from. Prefix is usually wf_live_.',
            required: true,
        },
        {
            displayName: 'API Secret',
            name: 'apiSecret',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            description:
                'Shown only once when the key is created. If you lost it, revoke the key in the dashboard and generate a new pair. Click Test after saving — a green tick means /me.php accepted the key.',
            required: true,
        },
    ];

    /**
     * Attached to every outgoing request from both the main node and the
     * trigger node. n8n expands the `={{...}}` expressions from the stored
     * credential values at runtime.
     */
    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.apiKey}}:{{$credentials.apiSecret}}',
                Accept: 'application/json',
            },
        },
    };

    /**
     * The "Test" button in the credential form calls this. We hit /me.php
     * which validates the key, returns the bound instance, and bumps the
     * last_used_at timestamp -- a safe no-op that proves everything works
     * end-to-end (network, auth, plan feature gating).
     */
    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "").replace(/\\/api\\/v1$/, "")}}/api/v1',
            url: '/me.php',
            method: 'GET',
        },
    };
}
