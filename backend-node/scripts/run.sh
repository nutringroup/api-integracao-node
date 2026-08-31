#!/bin/bash

# Script para executar a API Central Gummy em diferentes ambientes

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir ajuda
show_help() {
    echo -e "${BLUE}Central Gummy API - Script de Execução${NC}"
    echo ""
    echo "Uso: $0 [COMANDO] [AMBIENTE]"
    echo ""
    echo "Comandos:"
    echo "  start     - Inicia a aplicação"
    echo "  dev       - Inicia em modo desenvolvimento"
    echo "  worker    - Inicia apenas os workers"
    echo "  install   - Instala dependências"
    echo "  test      - Executa testes"
    echo "  lint      - Verifica código"
    echo ""
    echo "Ambientes:"
    echo "  dev       - Desenvolvimento (.env-dev)"
    echo "  homolog   - Homologação (.env-homolog)"
    echo "  prod      - Produção (.env-prod)"
    echo ""
    echo "Exemplos:"
    echo "  $0 start dev"
    echo "  $0 worker prod"
    echo "  $0 install"
}

# Função para configurar ambiente
setup_env() {
    local env=$1
    local env_file=""
    
    case $env in
        dev)
            env_file=".env-dev"
            ;;
        homolog)
            env_file=".env-homolog"
            ;;
        prod)
            env_file=".env-prod"
            ;;
        *)
            echo -e "${RED}Erro: Ambiente '$env' não reconhecido${NC}"
            echo "Ambientes disponíveis: dev, homolog, prod"
            exit 1
            ;;
    esac
    
    if [ ! -f "$env_file" ]; then
        echo -e "${RED}Erro: Arquivo $env_file não encontrado${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Configurando ambiente: $env${NC}"
    cp "$env_file" .env
}

# Função para instalar dependências
install_deps() {
    echo -e "${BLUE}Instalando dependências...${NC}"
    npm install
    echo -e "${GREEN}Dependências instaladas com sucesso!${NC}"
}

# Função para executar testes
run_tests() {
    echo -e "${BLUE}Executando testes...${NC}"
    npm test
}

# Função para verificar código
run_lint() {
    echo -e "${BLUE}Verificando código...${NC}"
    npm run lint
}

# Função para iniciar aplicação
start_app() {
    local env=$1
    setup_env "$env"
    
    echo -e "${GREEN}Iniciando Central Gummy API...${NC}"
    npm start
}

# Função para modo desenvolvimento
start_dev() {
    local env=${1:-dev}
    setup_env "$env"
    
    echo -e "${GREEN}Iniciando em modo desenvolvimento...${NC}"
    npm run dev
}

# Função para iniciar workers
start_worker() {
    local env=$1
    setup_env "$env"
    
    echo -e "${GREEN}Iniciando workers...${NC}"
    npm run worker
}

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}Erro: Execute este script no diretório raiz do projeto${NC}"
    exit 1
fi

# Processar argumentos
COMMAND=$1
ENVIRONMENT=$2

case $COMMAND in
    start)
        if [ -z "$ENVIRONMENT" ]; then
            echo -e "${RED}Erro: Ambiente é obrigatório para o comando start${NC}"
            show_help
            exit 1
        fi
        start_app "$ENVIRONMENT"
        ;;
    dev)
        start_dev "$ENVIRONMENT"
        ;;
    worker)
        if [ -z "$ENVIRONMENT" ]; then
            echo -e "${RED}Erro: Ambiente é obrigatório para o comando worker${NC}"
            show_help
            exit 1
        fi
        start_worker "$ENVIRONMENT"
        ;;
    install)
        install_deps
        ;;
    test)
        run_tests
        ;;
    lint)
        run_lint
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Erro: Comando '$COMMAND' não reconhecido${NC}"
        show_help
        exit 1
        ;;
esac 