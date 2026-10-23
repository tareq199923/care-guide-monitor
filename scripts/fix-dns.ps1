# One-shot DNS fix for this machine: replaces the 0.0.0.0 entry on the
# active Ethernet interface with working resolvers.
# Run from an ELEVATED PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\fix-dns.ps1
try {
    Set-DnsClientServerAddress -InterfaceIndex 47 -ServerAddresses ('192.168.0.1', '8.8.8.8')
    Write-Output 'DNS updated successfully.'
    Get-DnsClientServerAddress -InterfaceIndex 47 | Format-Table InterfaceAlias, AddressFamily, ServerAddresses -AutoSize
} catch {
    Write-Output ('FAILED (admin required?): ' + $_.Exception.Message)
    Write-Output 'Re-run from an ELEVATED PowerShell prompt.'
    exit 1
}
