/**
 * Optional DNS override for Node's resolver.
 *
 * Some machines (e.g. corporate NAT, locked-down home networks) cannot use
 * the default system resolver for MongoDB Atlas SRV records.  Set the
 * `DNS_SERVERS` env var to a comma-separated list of resolvers (e.g.
 * `8.8.8.8,1.1.1.1`) to override Node's default DNS.  When unset or empty,
 * the system resolver is used unchanged.
 *
 * Usage (call once at process start, before any mongoose.connect):
 *   require('../config/dns').applyDnsOverride();
 */
const dns = require('node:dns');

/**
 * Read the `DNS_SERVERS` env var (a comma-separated IP list, optionally
 * whitespace-padded) and call `dns.setServers()` with the parsed list.
 * When the var is unset, empty, or contains no valid entries, the function
 * is a no-op so the system resolver stays in effect.
 *
 * @returns {boolean} true if at least one server was applied
 */
function applyDnsOverride() {
  const raw = process.env.DNS_SERVERS;
  if (!raw || !raw.trim()) {
    return false;
  }

  const servers = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (servers.length === 0) {
    return false;
  }

  dns.setServers(servers);
  return true;
}

module.exports = { applyDnsOverride };
