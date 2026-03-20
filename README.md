# Worker Google Auth

## Overview
This repository functions as a centralized authentication microservice for GitHub Actions. Its primary responsibility is to generate short-lived Google OAuth2 Access Tokens and securely dispatch them to downstream worker repositories.

## Architecture & Integration
This worker acts as the "Identity Provider" for the automation ecosystem:
* **Token Generation**: It uses a Google Service Account (JSON Key) to sign a JWT (RS256) and exchange it for a temporary Access Token.
* **Downstream Trigger**: Once the token is generated, it triggers the `worker-hablla-integration` (or any specified repository) via the `repository_dispatch` API.
* **Payload Delivery**: The token is sent within the `client_payload`, allowing the destination repository to consume it without storing long-lived Google credentials.

## Technical Structure

### Folder Structure
* **.github/workflows/main.yml**: Configures the execution schedule (09:00 UTC) and manual triggers (workflow_dispatch).
* **index.js**: Pure Node.js implementation (no external dependencies) for JWT signing and GitHub API communication.
* **package.json**: Basic project metadata with zero runtime dependencies for maximum security and speed.

### Core Components
1. **JWT Signer**: Manually constructs and signs the Google Auth assertion using the `crypto` module.
2. **Secure Requester**: Uses the native `https` module to exchange the assertion for a token and to dispatch the event to GitHub.
3. **Dynamic Targeting**: Allows manual execution to specify a custom destination repository through the `REPO_DESTINO` environment variable.

## Security Implementation
* **Minimal Footprint**: By using only native Node.js modules, the attack surface is reduced as there are no third-party package vulnerabilities.
* **No Secret Leaks**: The script is specifically designed to suppress token logging. It only prints execution status (success/failure) without revealing the generated credentials.
* **Short-Lived Access**: Tokens generated are valid for only 60 minutes, adhering to the principle of least privilege.
* **Environment Isolation**: Private keys and Personal Access Tokens (PAT) are stored exclusively in GitHub Secrets.

## Optimization & Reliability
* **Fast Execution**: Completes in seconds due to the lack of `npm install` requirements.
* **Automated Scheduling**: Runs daily via CRON to ensure synchronized data is always available for the business reporting tools.
* **Error Handling**: Implements basic error catching to prevent silent failures during the authentication handshake.

## Setup
1. Add `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` to GitHub Secrets.
2. Add a `GH_PAT` (Personal Access Token) with `repo` permissions to allow dispatching events to other repositories.
3. Configure the `REPO_DESTINO` variable to match your integration worker's path.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Author

**Patrick Araujo - Security Researcher & Computer Engineer**  
**GitHub**: https://github.com/PkLavc  
