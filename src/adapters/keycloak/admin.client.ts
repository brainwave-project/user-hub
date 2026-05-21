/**
 * Keycloak Admin REST client — minimal surface needed by user-hub.
 *
 * Responsibilities:
 *   - Obtain a short-lived admin access token via the `master` realm
 *     password grant (admin-cli client, no secret needed in dev).
 *   - Create a user in the configured realm.
 *   - Extract the new user's UUID from the Location header.
 *
 * The token is cached for its lifetime so repeated create calls within the
 * same second don't re-authenticate.
 */

const BASE_URL    = process.env['KEYCLOAK_BASE_URL']      ?? 'http://keycloak:8080';
const REALM       = process.env['KEYCLOAK_REALM']         ?? 'brainwave';
const ADMIN_USER  = process.env['KEYCLOAK_ADMIN_USER']    ?? 'admin';
const ADMIN_PASS  = process.env['KEYCLOAK_ADMIN_PASSWORD'] ?? 'admin';

interface TokenCache {
  token:     string;
  expiresAt: number;   // epoch ms
}

let tokenCache: TokenCache | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAdminToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 10_000) {
    return tokenCache.token;
  }

  const res = await fetch(
    `${BASE_URL}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id:  'admin-cli',
        username:   ADMIN_USER,
        password:   ADMIN_PASS,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak admin auth failed (${res.status}): ${text}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token:     json.access_token,
    expiresAt: Date.now() + json.expires_in * 1_000,
  };
  return tokenCache.token;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateKeycloakUserInput {
  email:       string;
  firstName?:  string;
  password:    string;
  /** When true the user must change their password on first login. */
  temporary?:  boolean;
}

/**
 * Creates a user in Keycloak and returns their UUID (keycloakId / sub claim).
 * Throws if the email is already taken (409) or Keycloak is unreachable.
 */
export async function createKeycloakUser(input: CreateKeycloakUserInput): Promise<string> {
  const token = await getAdminToken();

  const res = await fetch(
    `${BASE_URL}/admin/realms/${REALM}/users`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        username:    input.email,
        email:       input.email,
        firstName:   input.firstName ?? '',
        enabled:     true,
        emailVerified: true,
        credentials: [
          {
            type:      'password',
            value:     input.password,
            temporary: input.temporary ?? true,
          },
        ],
      }),
    },
  );

  if (res.status === 409) {
    throw new Error(`DUPLICATE_EMAIL: ${input.email} is already registered in Keycloak`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak createUser failed (${res.status}): ${text}`);
  }

  // Keycloak returns the new user URL in the Location header:
  //   /admin/realms/brainwave/users/<uuid>
  const location = res.headers.get('Location');
  if (!location) throw new Error('Keycloak did not return a Location header after user creation');

  const keycloakId = location.split('/').pop();
  if (!keycloakId) throw new Error(`Could not extract keycloakId from Location: ${location}`);

  return keycloakId;
}

/**
 * Deletes a user from Keycloak by their UUID.
 * Used for rollback if the DB create fails after a successful Keycloak create.
 */
export async function deleteKeycloakUser(keycloakId: string): Promise<void> {
  const token = await getAdminToken();
  await fetch(
    `${BASE_URL}/admin/realms/${REALM}/users/${keycloakId}`,
    {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    },
  );
}
