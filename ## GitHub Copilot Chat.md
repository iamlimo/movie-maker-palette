## GitHub Copilot Chat

- Extension: 0.51.1 (prod)
- VS Code: 1.123.1 (ffa3c3f656c8df32d894e5f4d3673284d424205e)
- OS: linux 7.0.0-27-generic x64
- GitHub Account: iamlimo

## Network

User Settings:
```json
  "http.systemCertificatesNode": true,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 140.82.121.6 (78 ms)
- DNS ipv6 Lookup: Error (17 ms): getaddrinfo ENOTFOUND api.github.com
- Proxy URL: None (27 ms)
- Electron fetch (configured): HTTP 200 (451 ms)
- Node.js https: HTTP 200 (612 ms)
- Node.js fetch: HTTP 200 (968 ms)

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: 140.82.112.22 (26 ms)
- DNS ipv6 Lookup: Error (4 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (19 ms)
- Electron fetch (configured): HTTP 200 (220 ms)
- Node.js https: HTTP 200 (1199 ms)
- Node.js fetch: HTTP 200 (3947 ms)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: 20.199.39.224 (800 ms)
- DNS ipv6 Lookup: Error (417 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (55 ms)
- Electron fetch (configured): HTTP 200 (2083 ms)
- Node.js https: HTTP 200 (2498 ms)
- Node.js fetch: HTTP 200 (703 ms)

Connecting to https://mobile.events.data.microsoft.com: HTTP 404 (2541 ms)
Connecting to https://dc.services.visualstudio.com: HTTP 404 (4619 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (2968 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (2476 ms)
Connecting to https://default.exp-tas.com: HTTP 400 (2925 ms)

Number of system certificates: 365

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).