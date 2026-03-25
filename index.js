const crypto = require("crypto");
const https = require("https");
const sodium = require('libsodium-wrappers');

// Função para registrar eventos com segurança
function secureLog(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logLevel = isError ? 'ERROR' : 'INFO';
    console.log(`[${timestamp}] [${logLevel}] ${message}`);
}

/**
 * Função para atualizar o Secret no repositório de destino
 * O GitHub exige que o valor seja criptografado com a chave pública do repo de destino.
 */
async function updateGitHubSecret(repo, secretName, newValue, ghToken) {
    await sodium.ready;
    
    // 1. Obter a chave pública do repositório de destino
    const publicKey = await new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${repo}/actions/secrets/public-key`,
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Google-Auth-Orchestrator'
            }
        };
        https.get(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) reject(new Error(`Erro ao obter chave pública: ${res.statusCode}`));
                else resolve(JSON.parse(data));
            });
        }).on('error', reject);
    });

    // 2. Criptografar o token usando a chave pública
    const binKey = Buffer.from(publicKey.key, 'base64');
    const binSec = Buffer.from(newValue);
    const encBytes = sodium.crypto_box_seal(binSec, binKey);
    const encryptedValue = Buffer.from(encBytes).toString('base64');

    // 3. Enviar o segredo criptografado via PUT
    return new Promise((resolve, reject) => {
        const req = https.request(`https://api.github.com/repos/${repo}/actions/secrets/${secretName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Google-Auth-Orchestrator',
                'Content-Type': 'application/json'
            }
        }, res => {
            if (res.statusCode === 201 || res.statusCode === 204) {
                secureLog(`Secret ${secretName} atualizado com sucesso em ${repo}`);
                resolve();
            } else {
                reject(new Error(`Erro ao gravar Secret no GitHub: ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.write(JSON.stringify({
            encrypted_value: encryptedValue,
            key_id: publicKey.key_id
        }));
        req.end();
    });
}

async function run() {
    try {
        const client_email = process.env.GOOGLE_CLIENT_EMAIL;
        const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const token_uri = "https://oauth2.googleapis.com/token";
        const repo_destino = process.env.REPO_DESTINO; 
        const gh_token = process.env.GH_PAT;

        if (!client_email || !private_key || !repo_destino || !gh_token) {
            secureLog("Variáveis de ambiente críticas ausentes", true);
            process.exit(1);
        }

        // --- GERAÇÃO DO JWT ---
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: client_email,
            scope: "https://www.googleapis.com/auth/spreadsheets",
            aud: token_uri,
            exp: now + 3600,
            iat: now
        };
        const header = { alg: "RS256", typ: "JWT" };
        const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        const tokenToSign = `${b64(header)}.${b64(payload)}`;
        const signature = crypto.createSign("RSA-SHA256").update(tokenToSign).sign(private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        const jwt = `${tokenToSign}.${signature}`;

        // --- SOLICITAÇÃO DO ACCESS TOKEN ---
        const accessToken = await new Promise((resolve, reject) => {
            const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
            const req = https.request(token_uri, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }, res => {
                let data = "";
                res.on("data", c => data += c);
                res.on("end", () => resolve(JSON.parse(data).access_token));
            });
            req.on("error", reject);
            req.write(postData);
            req.end();
        });

        if (!accessToken) throw new Error("Falha ao obter Access Token do Google");

        // --- ETAPA DE SEGURANÇA: ATUALIZAR O SECRET NO DESTINO ---
        secureLog(`Iniciando atualização de Secret em: ${repo_destino}`);
        await updateGitHubSecret(repo_destino, "GOOGLE_TOKEN", accessToken, gh_token);

        // --- DISPARO DO WORKFLOW (Payload sem o token por segurança) ---
        const dispatchReq = https.request(`https://api.github.com/repos/${repo_destino}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gh_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Google-Auth-Orchestrator'
            }
        }, (res) => {
            if (res.statusCode === 204) secureLog("Workflow de destino disparado com sucesso.");
            else secureLog(`Falha ao disparar workflow. Status: ${res.statusCode}`, true);
        });

        dispatchReq.write(JSON.stringify({
            event_type: "google_token_ready",
            client_payload: { status: "updated" } 
        }));
        dispatchReq.end();

        // --- LOG NO MONITOR CENTRAL ---
        const nomeWorker = repo_destino.split('/').pop();
        const logReq = https.request(`https://api.github.com/repos/operacoesicaiu/cloud-operations-monitor/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gh_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Google-Auth-Orchestrator'
            }
        });
        logReq.write(JSON.stringify({
            event_type: "log_event",
            client_payload: { message: `Token atualizado e workflow disparado para ${nomeWorker}` }
        }));
        logReq.end();

        secureLog("Processo concluído com segurança máxima.");

    } catch (err) {
        secureLog(`Erro no processo: ${err.message}`, true);
        process.exit(1);
    }
}

run();
