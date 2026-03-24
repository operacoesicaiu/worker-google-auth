# Worker Google Auth

## Visão Geral

O Worker Google Auth é um componente essencial do ecossistema de integração que gera tokens de acesso para Google Sheets através do fluxo OAuth2. Este worker atua como orquestrador central, distribuindo tokens para outros workers que necessitam de acesso às planilhas do Google.

## Arquitetura do Sistema

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Worker Google  │    │   Workers       │
│   Actions       │───▶│   Auth           │───▶│   Destino       │
│   Scheduler     │    │   (Orquestrador) │    │   (Zenvia,      │
└─────────────────┘    └──────────────────┘    │   Zoho, etc)    │
                                               └─────────────────┘
```

## Fluxo de Operação

### 1. Geração de Token JWT
- **Entrada**: Credenciais do Google Service Account (Client Email, Private Key)
- **Processo**: Criação de JWT assinado com algoritmo RS256
- **Saída**: JWT pronto para troca por Access Token

### 2. Troca por Access Token
- **Endpoint**: `https://oauth2.googleapis.com/token`
- **Método**: POST com grant_type `urn:ietf:params:oauth:grant-type:jwt-bearer`
- **Validade**: 1 hora (3600 segundos)

### 3. Distribuição de Tokens
- **Destino**: Repositórios configurados via `REPO_DESTINO`
- **Evento**: `google_token_ready` via GitHub API Dispatch
- **Payload**: Token de acesso encriptado

## Segurança Implementada

### 🔒 **Proteção de Dados Sensíveis**
- **Mascaramento**: Função `maskSensitiveData()` oculta credenciais nos logs
- **Logging Seguro**: Função `secureLog()` registra eventos sem expor dados
- **Validação**: Verificação de variáveis essenciais antes da execução

### 🛡️ **Proteção contra Vazamentos**
- **Zero Logs Sensíveis**: Nenhum token ou credencial aparece nos logs
- **Erros Genéricos**: Mensagens de erro sem detalhes que possam comprometer segurança
- **Timeout Controlado**: Requisições com timeouts para evitar falhas silenciosas

### 🔐 **Comunicação Segura**
- **HTTPS Exclusivo**: Todas as chamadas externas usam conexão criptografada
- **Headers de Segurança**: Identificação clara do agente sem expor informações sensíveis
- **Autenticação**: Uso de tokens de acesso em vez de credenciais permanentes

## Configuração de Segredos

### Requisitos Mínimos
```yaml
GOOGLE_CLIENT_EMAIL: "service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD..."
GH_PAT: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
REPO_DESTINO: "operacoesicaiu/worker-zenvia-integration"
```

### Segurança dos Segredos
- **Armazenamento**: Secrets do GitHub Actions (criptografados)
- **Acesso**: Apenas workers autorizados podem acessar
- **Rotação**: Recomendado rotacionar chaves periodicamente

## Monitoramento e Logs

### Estratégia de Logs
- **Formato**: `[TIMESTAMP] [LEVEL] MESSAGE`
- **Níveis**: INFO para operações normais, ERROR para falhas
- **Conteúdo**: Mensagens descritivas sem dados sensíveis
- **Armazenamento**: Arquivo `daily_uptime.log` no repositório monitor

### Exemplos de Logs Seguros
```
[2026-03-24T13:30:15.123Z] [INFO] Iniciando autenticação Zoho
[2026-03-24T13:30:16.456Z] [INFO] Autenticação Zoho realizada com sucesso
[2026-03-24T13:30:17.789Z] [INFO] Filtrando registros de ontem (23-Mar-2026)
```

## Integração com Outros Workers

### Workers Destinatários
1. **worker-zenvia-integration**: Sincroniza dados da API Zenvia
2. **worker-zoho-integration**: Sincroniza dados do Zoho Creator
3. **worker-zenvia-integration**: Sincroniza dados da API Zenvia

### Protocolo de Comunicação
```json
{
  "event_type": "google_token_ready",
  "client_payload": {
    "token": "ya29.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

## Estratégia de Escalabilidade

### Distribuição de Carga
- **Orquestração Central**: Único ponto de geração de tokens
- **Distribuição Paralela**: Múltiplos workers podem receber tokens simultaneamente
- **Monitoramento**: Registro de todas as distribuições para auditoria

### Estratégia de Failover
- **Validação de Token**: Verificação antes da distribuição
- **Retentativas**: Lógica de retry para falhas de comunicação
- **Fallback**: Alternativas caso algum worker não responda

## Métricas de Segurança

### Indicadores de Monitoramento
- **Tempo de Geração**: Média de tempo para gerar tokens
- **Taxa de Sucesso**: Percentual de distribuições bem-sucedidas
- **Falhas de Segurança**: Tentativas de acesso não autorizadas
- **Uso de Recursos**: Consumo de API e tempo de execução

### Alertas de Segurança
- **Falha na Autenticação**: Erros na geração de JWT
- **Distribuição Falhada**: Workers que não recebem tokens
- **Timeout de Requisição**: Respostas lentas da API do Google
- **Erros de Validação**: Variáveis de ambiente ausentes ou inválidas

## Melhores Práticas

### Para Desenvolvedores
1. **Nunca use `console.log` para dados sensíveis**
2. **Sempre valide variáveis de ambiente**
3. **Use mascaramento para qualquer dado sensível**
4. **Trate erros sem expor detalhes**

### Para Operações
1. **Monitorar logs regularmente** para detectar anomalias
2. **Rotacionar segredos periodicamente** para manter a segurança
3. **Testar failover** para garantir disponibilidade
4. **Auditar permissões** de acesso aos segredos

## Conformidade e Auditoria

### Registros de Auditoria
- **Operações de Token**: Registro de todas as gerações e distribuições
- **Acessos aos Segredos**: Log de quem e quando acessou credenciais
- **Falhas de Segurança**: Registro detalhado de incidentes de segurança
- **Alterações de Configuração**: Histórico de mudanças nas configurações

### Relatórios de Conformidade
- **Relatórios Diários**: Resumo das operações do dia
- **Relatórios Semanais**: Análise de performance e segurança
- **Relatórios Mensais**: Conformidade com políticas de segurança
- **Incidentes de Segurança**: Documentação completa de incidentes

## Documentação Técnica

### Estrutura de Código
```
worker-google-auth/
├── index.js              # Lógica principal de autenticação
├── .github/workflows/    # Configuração do GitHub Actions
│   ├── main.yml         # Execução programada
│   └── test_report_auth.yml # Testes de relatório
└── README.md            # Documentação do projeto
```

### Dependências
- **Node.js**: Versão 20+ recomendada
- **Módulos Nativos**: `crypto`, `https` (sem dependências externas)
- **APIs Externas**: Google OAuth2, GitHub API

### Performance
- **Tempo de Execução**: ~5-10 segundos por ciclo
- **Uso de Memória**: <50MB
- **Consumo de API**: 1 requisição ao Google + N requisições ao GitHub
- **Escalabilidade**: Suporta até 10 workers simultâneos

## Suporte e Manutenção

### Contatos de Suporte
- **Desenvolvimento**: pklavc@gmail.com
- **Operações**: [Definir contato interno]
- **Segurança**: [Definir contato de segurança]

### Procedimentos de Manutenção
1. **Atualizações de Segurança**: Aplicar patches semanalmente
2. **Rotatividade de Chaves**: Renovar chaves a cada 90 dias
3. **Auditoria de Logs**: Revisão mensal de logs de segurança
4. **Testes de Integração**: Validar integração com workers semanalmente

---

## Security Overview

### Security Measures Implemented

#### 🔒 **Sensitive Data Protection**
- **Data Masking**: `maskSensitiveData()` function hides credentials in logs
- **Secure Logging**: `secureLog()` function logs events without exposing data
- **Validation**: Verification of essential variables before execution

#### 🛡️ **Leak Prevention**
- **Zero Sensitive Logs**: No tokens or credentials appear in logs
- **Generic Errors**: Error messages without details that could compromise security
- **Controlled Timeout**: Requests with timeouts to prevent silent failures

#### 🔐 **Secure Communication**
- **HTTPS Only**: All external calls use encrypted connection
- **Security Headers**: Clear agent identification without exposing sensitive information
- **Authentication**: Use of access tokens instead of permanent credentials

### Security Configuration

#### Minimum Requirements
```yaml
GOOGLE_CLIENT_EMAIL: "service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD..."
GH_PAT: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
REPO_DESTINO: "operacoesicaiu/worker-zenvia-integration"
```

#### Secret Security
- **Storage**: GitHub Actions secrets (encrypted)
- **Access**: Only authorized workers can access
- **Rotation**: Recommended to rotate keys periodically

### Security Monitoring

#### Log Strategy
- **Format**: `[TIMESTAMP] [LEVEL] MESSAGE`
- **Levels**: INFO for normal operations, ERROR for failures
- **Content**: Descriptive messages without sensitive data
- **Storage**: `daily_uptime.log` file in monitor repository

#### Secure Log Examples
```
[2026-03-24T13:30:15.123Z] [INFO] Starting Zoho authentication
[2026-03-24T13:30:16.456Z] [INFO] Zoho authentication completed successfully
[2026-03-24T13:30:17.789Z] [INFO] Filtering records from yesterday (23-Mar-2026)
```

### Security Metrics

#### Monitoring Indicators
- **Generation Time**: Average time to generate tokens
- **Success Rate**: Percentage of successful distributions
- **Security Failures**: Unauthorized access attempts
- **Resource Usage**: API consumption and execution time

#### Security Alerts
- **Authentication Failure**: Errors in JWT generation
- **Distribution Failed**: Workers that don't receive tokens
- **Request Timeout**: Slow responses from Google API
- **Validation Errors**: Missing or invalid environment variables

### Compliance and Auditing

#### Audit Records
- **Token Operations**: Record of all generations and distributions
- **Secret Access**: Log of who and when accessed credentials
- **Security Incidents**: Detailed record of security incidents
- **Configuration Changes**: History of configuration changes

#### Compliance Reports
- **Daily Reports**: Summary of daily operations
- **Weekly Reports**: Performance and security analysis
- **Monthly Reports**: Compliance with security policies
- **Security Incidents**: Complete documentation of incidents

---

## Segurança dos Repositórios Públicos

### Medidas de Segurança Implementadas

#### 🔒 **Proteção de Dados Sensíveis**
- **Mascaramento de Dados**: Função `maskSensitiveData()` oculta credenciais nos logs
- **Registro Seguro**: Função `secureLog()` registra eventos sem expor dados
- **Validação**: Verificação de variáveis essenciais antes da execução

#### 🛡️ **Proteção contra Vazamentos**
- **Zero Logs Sensíveis**: Nenhum token ou credencial aparece nos logs
- **Erros Genéricos**: Mensagens de erro sem detalhes que possam comprometer segurança
- **Timeout Controlado**: Requisições com timeouts para evitar falhas silenciosas

#### 🔐 **Comunicação Segura**
- **HTTPS Exclusivo**: Todas as chamadas externas usam conexão criptografada
- **Headers de Segurança**: Identificação clara do agente sem expor informações sensíveis
- **Autenticação**: Uso de tokens de acesso em vez de credenciais permanentes

### Configuração de Segurança

#### Requisitos Mínimos
```yaml
GOOGLE_CLIENT_EMAIL: "service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD..."
GH_PAT: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
REPO_DESTINO: "operacoesicaiu/worker-zenvia-integration"
```

#### Segurança dos Segredos
- **Armazenamento**: Secrets do GitHub Actions (criptografados)
- **Acesso**: Apenas workers autorizados podem acessar
- **Rotação**: Recomendado rotacionar chaves periodicamente

### Monitoramento de Segurança

#### Estratégia de Logs
- **Formato**: `[TIMESTAMP] [LEVEL] MESSAGE`
- **Níveis**: INFO para operações normais, ERROR para falhas
- **Conteúdo**: Mensagens descritivas sem dados sensíveis
- **Armazenamento**: Arquivo `daily_uptime.log` no repositório monitor

#### Exemplos de Logs Seguros
```
[2026-03-24T13:30:15.123Z] [INFO] Iniciando autenticação Zoho
[2026-03-24T13:30:16.456Z] [INFO] Autenticação Zoho realizada com sucesso
[2026-03-24T13:30:17.789Z] [INFO] Filtrando registros de ontem (23-Mar-2026)
```

### Métricas de Segurança

#### Indicadores de Monitoramento
- **Tempo de Geração**: Média de tempo para gerar tokens
- **Taxa de Sucesso**: Percentual de distribuições bem-sucedidas
- **Falhas de Segurança**: Tentativas de acesso não autorizadas
- **Uso de Recursos**: Consumo de API e tempo de execução

#### Alertas de Segurança
- **Falha na Autenticação**: Erros na geração de JWT
- **Distribuição Falhada**: Workers que não recebem tokens
- **Timeout de Requisição**: Respostas lentas da API do Google
- **Erros de Validação**: Variáveis de ambiente ausentes ou inválidas

### Conformidade e Auditoria

#### Registros de Auditoria
- **Operações de Token**: Registro de todas as gerações e distribuições
- **Acessos aos Segredos**: Log de quem e quando acessou credenciais
- **Falhas de Segurança**: Registro detalhado de incidentes de segurança
- **Alterações de Configuração**: Histórico de mudanças nas configurações

#### Relatórios de Conformidade
- **Relatórios Diários**: Resumo das operações do dia
- **Relatórios Semanais**: Análise de performance e segurança
- **Relatórios Mensais**: Conformidade com políticas de segurança
- **Incidentes de Segurança**: Documentação completa de incidentes