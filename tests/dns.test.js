const dns = require('node:dns');
const { applyDnsOverride } = require('../src/config/dns');

describe('dns.applyDnsOverride', () => {
  let capturedServers;

  beforeEach(() => {
    capturedServers = null;
    jest.spyOn(dns, 'setServers').mockImplementation((servers) => {
      capturedServers = servers;
    });
    delete process.env.DNS_SERVERS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing when DNS_SERVERS is unset', () => {
    const applied = applyDnsOverride();
    expect(applied).toBe(false);
    expect(dns.setServers).not.toHaveBeenCalled();
  });

  test('does nothing when DNS_SERVERS is empty or whitespace', () => {
    process.env.DNS_SERVERS = '   ';
    expect(applyDnsOverride()).toBe(false);
    expect(dns.setServers).not.toHaveBeenCalled();

    process.env.DNS_SERVERS = '';
    expect(applyDnsOverride()).toBe(false);
    expect(dns.setServers).not.toHaveBeenCalled();
  });

  test('applies a single resolver', () => {
    process.env.DNS_SERVERS = '8.8.8.8';
    expect(applyDnsOverride()).toBe(true);
    expect(capturedServers).toEqual(['8.8.8.8']);
  });

  test('applies multiple resolvers with whitespace', () => {
    process.env.DNS_SERVERS = '  8.8.8.8 , 1.1.1.1  ';
    expect(applyDnsOverride()).toBe(true);
    expect(capturedServers).toEqual(['8.8.8.8', '1.1.1.1']);
  });

  test('ignores empty entries in a comma list', () => {
    process.env.DNS_SERVERS = '8.8.8.8,,1.1.1.1,';
    expect(applyDnsOverride()).toBe(true);
    expect(capturedServers).toEqual(['8.8.8.8', '1.1.1.1']);
  });

  test('returns false when the list contains only empty entries', () => {
    process.env.DNS_SERVERS = ', ,';
    expect(applyDnsOverride()).toBe(false);
    expect(dns.setServers).not.toHaveBeenCalled();
  });
});
