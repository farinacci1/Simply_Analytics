import { SAML } from '@node-saml/node-saml';
import { query } from '../db/db.js';
import configStore from '../config/configStore.js';

let saml = null;
let samlConfigHash = null;

function getSaml() {
  const enabled = configStore.get('SSO_ENABLED') === 'true';
  if (!enabled) throw new Error('SSO is not enabled');

  const cert = configStore.get('SAML_CERT');
  const entryPoint = configStore.get('SAML_ENTRYPOINT');
  const issuer = configStore.get('SAML_ISSUER') || 'simply-analytics';
  const callbackUrl = configStore.get('SAML_CALLBACK_URL');

  const hash = `${cert}|${entryPoint}|${issuer}|${callbackUrl}`;
  if (saml && samlConfigHash === hash) return saml;

  if (!cert) throw new Error('SAML_CERT is required when SSO is enabled');

  saml = new SAML({
    entryPoint,
    issuer,
    callbackUrl,
    cert,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    maxAssertionAgeMs: 5 * 60 * 1000,
  });
  samlConfigHash = hash;

  return saml;
}

export function isEnabled() {
  return configStore.get('SSO_ENABLED') === 'true';
}

export async function getLoginUrl(relayState) {
  const s = getSaml();
  const url = await s.getAuthorizeUrlAsync(relayState || '', {}, {});
  return url;
}

export async function getMetadata() {
  const s = getSaml();
  return s.generateServiceProviderMetadata(null, configStore.get('SAML_CERT'));
}

export async function validateCallback(body) {
  const s = getSaml();
  const { profile } = await s.validatePostResponseAsync(body);

  if (!profile) throw new Error('SAML assertion validation failed');

  const email = profile.email || profile.nameID;
  const nameID = profile.nameID;
  const externalId = profile.nameID;

  if (!email) throw new Error('SAML assertion missing email or nameID');

  const user = await findScimUser(email, externalId);

  return { user, nameID, sessionIndex: profile.sessionIndex };
}

async function findScimUser(email, externalId) {
  let result = await query(
    'SELECT * FROM users WHERE external_id = $1 AND auth_provider = $2',
    [externalId, 'saml']
  );
  if (result.rows[0]) return result.rows[0];

  result = await query(
    'SELECT * FROM users WHERE email = $1 AND auth_provider = $2',
    [email, 'saml']
  );
  if (result.rows[0]) return result.rows[0];

  throw new Error('User has not been provisioned. Contact your administrator to request access via SCIM.');
}

export async function handleLogout(nameID, sessionIndex) {
  if (!nameID) return;
  await query(
    'UPDATE users SET active_session_id = NULL, session_expires_at = NULL WHERE external_id = $1 AND auth_provider = $2',
    [nameID, 'saml']
  );
}

export default { isEnabled, getLoginUrl, getMetadata, validateCallback, handleLogout };
