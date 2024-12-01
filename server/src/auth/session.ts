export interface SessionPayload {
    sub: string;         // subject (player ID)
    iat: number;        // issued at
    exp: number;        // expiration time
    type: string;       // token type
}

// 30 days in milliseconds
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

function base64UrlEncode(str: string): string {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export async function createSessionToken(playerId: string, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { 
        sub: playerId, 
        iat: Date.now(),
        exp: Date.now() + SESSION_DURATION  // Add expiration time
    };
    
    // Convert to base64
    const headerB64 = btoa(JSON.stringify(header));
    const payloadB64 = btoa(JSON.stringify(payload));
    
    // Create the signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const keyData = encoder.encode(secret);
    
    // Create key with same parameters as verification
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        data
    );

    // Convert signature to base64
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    console.log("Created token parts:", {
        headerB64,
        payloadB64,
        signatureB64,
        secret
    });

    return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        
        // Create key with same parameters as signing
        const encoder = new TextEncoder();
        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        // Convert signature from base64url to binary
        const signatureBinary = new Uint8Array(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
            .split('')
            .map(char => char.charCodeAt(0))
        );

        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBinary,
            data
        );

        if (!isValid) {
            console.error("Invalid signature");
            return null;
        }

        return JSON.parse(atob(payloadB64));
    } catch (error) {
        console.error("Token verification error:", error);
        return null;
    }
}

// Helper function to convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = '='.repeat((4 - base64Url.length % 4) % 4);
    const base64 = (base64Url + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function createSessionCookie(token: string): string {
    // If token is empty, set an expired date
    const expires = token 
        ? new Date(Date.now() + SESSION_DURATION).toUTCString()
        : 'Thu, 01 Jan 1970 00:00:00 UTC';

    return `session=${token}; `
        + 'Path=/; '
        + 'HttpOnly; '
        + 'Secure; '
        + 'SameSite=None; '
        + `Expires=${expires}`;
} 