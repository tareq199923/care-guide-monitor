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

// Regression test: dns.js must load .env itself so that DNS_SERVERS set in
// .env is honored even when applyDnsOverride() is called before env.js runs.
describe('dns.applyDnsOverride loads .env itself', () => {
  test('reads DNS_SERVERS from a temp .env file', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const { spawnSync } = require('node:child_process');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dns-env-test-'));
    fs.writeFileSync(path.join(tmpDir, '.env'), 'DNS_SERVERS=9.9.9.9,149.112.112.112\n');

    const scriptPath = path.resolve(__dirname, '../src/config/dns.js');

    // Strip DNS_SERVERS from the inherited env so only the temp .env can set it.
    const childEnv = { ...process.env };
    delete childEnv.DNS_SERVERS;
    childEnv.DNS_TEST_MODULE = scriptPath;

    const child = spawnSync(
      process.execPath,
      [
        '--input-type=commonjs',
        '-e',
        [
          "const dns = require('node:dns');",
          'const { applyDnsOverride } = require(process.env.DNS_TEST_MODULE);',
          'const ok = applyDnsOverride();',
          "console.log(JSON.stringify(dns.getServers()) + ' ' + ok);",
        ].join(''),
      ],
      { cwd: tmpDir, encoding: 'utf8', env: childEnv }
    );

    expect(child.status).toBe(0);
    const output = child.stdout.trim();
    // Output format: <JSON-array> <true|false>
    const lastSpace = output.lastIndexOf(' ');
    const servers = JSON.parse(output.slice(0, lastSpace));
    const applied = output.slice(lastSpace + 1);

    expect(applied).toBe('true');
    expect(servers).toEqual(['9.9.9.9', '149.112.112.112']);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
