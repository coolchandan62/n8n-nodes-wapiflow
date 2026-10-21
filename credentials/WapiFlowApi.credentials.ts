import type {
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
 *
 * Authentication header format expected by WapiFlow:
 *   Authorization: Bearer wf_live_KEY:SECRET
 */
export class WapiFlowApi implements ICredentialType {
    name = 'wapiFlowApi';

    displayName = 'WapiFlow API';

    documentationUrl = 'https://docs.n8n.io/integrations/credentials/wapiFlowApi/';

    properties: INodeProperties[] = [
        {
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: 'https://wapiflow.webdescent.com',
            placeholder: 'https://wapiflow.webdescent.com',
            description:
                'Your WapiFlow installation URL without the trailing /api/v1. Example: https://wapi.acme.com.',
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
                'Generated under Developer → API Keys in your WapiFlow dashboard. Each key is bound to one WhatsApp instance.',
            required: true,
        },
        {
            displayName: 'API Secret',
            name: 'apiSecret',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            description:
                'Shown only once when the key is generated. If you lost it, revoke the key and create a new one.',
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
     * last_used_at timestamp — a safe no-op that proves everything works
     * end-to-end (network, auth, plan feature gating).
     */
    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}/api/v1',
            url: '/me.php',
            method: 'GET',
        },
    };
}
