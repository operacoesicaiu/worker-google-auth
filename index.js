const crypto = require("crypto");
const https = require("https");
const { URL } = require("url");

async function getGoogleAccessToken() {
    console.log("===== Início da Autenticação =====");

    try {
        // 📌 Puxando das Variáveis de Ambiente (Configuradas no GitHub Secrets)
        const client_email = process.env.GOOGLE_CLIENT_EMAIL;
        const private_key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        const token_uri = "https://oauth2.googleapis.com/token";

        if (!client_email || !private_key) {
            throw new Error("Variáveis de ambiente GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY não encontradas.");
        }

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: client_email,
            scope: "https://www.googleapis.com/auth/spreadsheets",
            aud: token_uri,
            exp: now + 3600,
            iat: now
        };

        const header = { alg: "RS256", typ: "JWT" };

        function base64urlEncode(obj) {
            return Buffer.from(JSON.stringify(obj))
                .toString("base64")
                .replace(/=/g, "")
                .replace(/\+/g, "-")
                .replace(/\//g, "_");
        }

        const encodedHeader = base64urlEncode(header);
        const encodedPayload = base64urlEncode(payload);
        const tokenToSign = `${encodedHeader}.${encodedPayload}`;

        const signer = crypto.createSign("RSA-SHA256");
        signer.update(tokenToSign);
        const signature = signer.sign(private_key, "base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

        const jwt = `${tokenToSign}.${signature}`;
        const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;

        const url = new URL(token_uri);
        const options = {
            method: "POST",
            hostname: url.hostname,
            path: url.pathname,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData)
            }
        };

        const accessToken = await new Promise((resolve, reject) => {
            const req = https.request(options, res => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.access_token) resolve(json.access_token);
                        else reject(new Error(JSON.stringify(json)));
                    } catch (e) { reject(e); }
                });
            });
            req.on("error", reject);
            req.write(postData);
            req.end();
        });

        console.log("Token gerado com sucesso!");
        // Aqui você enviaria o token para o próximo Worker ou salvaria em um log
        console.log("Access Token:", accessToken); 

    } catch (err) {
        console.error("Erro no processo:", err.message);
        process.exit(1);
    }
}

getGoogleAccessToken();
