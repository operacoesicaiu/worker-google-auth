const crypto = require("crypto");
const https = require("https");

async function run() {
    try {
        // Puxando dos Secrets
        const client_email = process.env.GOOGLE_CLIENT_EMAIL;
        const private_key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        const token_uri = "https://oauth2.googleapis.com/token";
        
        // Destino dinâmico
        const repo_destino = process.env.REPO_DESTINO; 
        const gh_token = process.env.GH_PAT;

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
        const signer = crypto.createSign("RSA-SHA256").update(tokenToSign);
        const signature = signer.sign(private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        const jwt = `${tokenToSign}.${signature}`;

        // --- SOLICITAÇÃO DO ACCESS TOKEN ---
        const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
        
        const accessToken = await new Promise((resolve, reject) => {
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

        // ENVIO DIRETO (SEM LOGS)
        console.log(`[Segurança] Despachando token para: ${repo_destino}...`);

        const dispatchReq = https.request(`https://api.github.com/repos/${repo_destino}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gh_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Central-Auth-Bot'
            }
        }, (res) => {
            if (res.statusCode === 204) console.log("Token entregue com sucesso.");
            else console.log("Falha na entrega. Status:", res.statusCode);
        });

        dispatchReq.write(JSON.stringify({
            event_type: "google_token_ready",
            client_payload: { token: accessToken }
        }));
        dispatchReq.end();

        // --- REGISTRO DE ATIVIDADE NO MONITOR ---
        const nomeWorker = repo_destino.split('/').pop();
        const logMsg = `Execução: ${nomeWorker} disparada com sucesso.`;

        const logPayload = JSON.stringify({
            event_type: "log_event",
            client_payload: { message: logMsg }
        });

        const logReq = https.request(
            `https://api.github.com/repos/operacoesicaiu/cloud-operations-monitor/dispatches`, 
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gh_token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Google-Auth-Orchestrator'
                }
            }
        );

        logReq.write(logPayload);
        logReq.end();

    } catch (err) {
        console.error("Erro no processo silencioso.");
        process.exit(1);
    }
}
run();
