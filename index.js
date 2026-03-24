const crypto = require("crypto");
const https = require("https");

// Função para mascarar dados sensíveis
function maskSensitiveData(data, maxLength = 8) {
    if (!data || typeof data !== 'string') return '[MASKED]';
    if (data.length <= maxLength) return '[MASKED]';
    return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
}

// Função para registrar eventos sem expor dados sensíveis
function secureLog(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logLevel = isError ? 'ERROR' : 'INFO';
    console.log(`[${timestamp}] [${logLevel}] ${message}`);
}

// Função para impedir Spreadsheet Formula Injection
function sanitize(val) {
    if (typeof val !== 'string') return val;
    const formulaChars = ['=', '+', '-', '@'];
    if (formulaChars.some(char => val.startsWith(char))) {
        return `'${val}`;
    }
    return val;
}

async function run() {
    try {
        // Validação de variáveis essenciais
        const client_email = process.env.GOOGLE_CLIENT_EMAIL;
        const private_key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        const token_uri = "https://oauth2.googleapis.com/token";
        const repo_destino = process.env.REPO_DESTINO; 
        const gh_token = process.env.GH_PAT;

        if (!client_email || !private_key || !repo_destino || !gh_token) {
            secureLog("Variáveis de ambiente críticas ausentes", true);
            process.exit(1);
        }

        // Geração do JWT
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

        // Solicitação do Access Token
        const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
        
        const accessToken = await new Promise((resolve, reject) => {
            const req = https.request(token_uri, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Google-Auth-Worker/1.0"
                }
            }, res => {
                let data = "";
                res.on("data", c => data += c);
                res.on("end", () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.access_token) {
                            resolve(response.access_token);
                        } else {
                            reject(new Error("Token não retornado pela API"));
                        }
                    } catch (parseError) {
                        reject(new Error("Resposta inválida da API de autenticação"));
                    }
                });
            });
            req.on("error", reject);
            req.write(postData);
            req.end();
        });

        // Validação do token obtido
        if (!accessToken) {
            secureLog("Token de acesso não gerado", true);
            process.exit(1);
        }

        // Envio do token para repositórios
        secureLog(`Despachando token para: ${repo_destino}`);

        const dispatchReq = https.request(`https://api.github.com/repos/${repo_destino}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gh_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Central-Auth-Bot'
            }
        }, (res) => {
            if (res.statusCode === 204) {
                secureLog("Token entregue com sucesso");
            } else {
                secureLog(`Falha na entrega. Status: ${res.statusCode}`, true);
            }
        });

        dispatchReq.write(JSON.stringify({
            event_type: "google_token_ready",
            client_payload: { token: accessToken }
        }));
        dispatchReq.end();

        // Registro de atividade no monitor
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

        secureLog("Processo concluído com sucesso");

    } catch (err) {
        secureLog("Erro no processo de autenticação", true);
        process.exit(1);
    }
}
run();
