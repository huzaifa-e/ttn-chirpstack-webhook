Place your Cloudflare Origin Certificate files in this directory:

- origin.crt
- origin.key

How to get them:
1) Cloudflare Dashboard -> SSL/TLS -> Origin Server -> Create Certificate
2) Hostname: ttn-webhook.isis-ic.com
3) Copy certificate PEM to origin.crt
4) Copy private key PEM to origin.key

Then restart stack:
- docker compose -f compose.nginx.yaml up -d --build
