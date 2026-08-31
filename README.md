# Projeto de Integração Shopify-Omie

Este projeto é uma solução de integração entre as plataformas Shopify e Omie, com funcionalidades adicionais para gerenciamento de pedidos, rastreamento e notificações.

## Índice

1. [Visão Geral](#visão-geral)
2. [Componentes Principais](#componentes-principais)
3. [Funcionalidades](#funcionalidades)
4. [Instalação](#instalação)
5. [Configuração](#configuração)
6. [Uso](#uso)
7. [Documentação Detalhada](#documentação-detalhada)
8. [Contribuição](#contribuição)
9. [Licença](#licença)

## Visão Geral

O projeto consiste em uma aplicação Laravel que gerencia a sincronização de pedidos entre Shopify e Omie, processa atualizações de rastreamento, envia notificações e fornece interfaces para visualização de logs e reintegração de pedidos.

## Componentes Principais

- **Views**:
  - `reintegrate.blade.php`: Interface para reintegração de pedidos
  - `dashboard.blade.php`: Painel para visualização de logs de pedidos

- **Controllers**:
  - `OmieController`: Gerencia interações com a API do Omie
  - `ShopifyController`: Gerencia interações com a API do Shopify
  - `HistoryLogController`: Gerencia exibição e recuperação de logs
  - `SyngooController`: Gerencia envio de mensagens via API Syngoo
  - `EstocaController`: Gerencia atualizações de rastreamento de pedidos

- **Jobs**:
  - `SendToOmie`: Envia dados de pedidos para o Omie
  - `ApproveOrderJob`: Aprova pedidos no Shopify e envia para o Omie
  - `CreateOrderJob`: Cria novos pedidos no sistema

- **Commands**:
  - `TarefaDiaria`: Comando Artisan para sincronização diária de pedidos

## Funcionalidades

- Sincronização de pedidos entre Shopify e Omie
- Criação e atualização de clientes no Omie
- Processamento de atualizações de rastreamento
- Envio de notificações via Syngoo
- Visualização e filtragem de logs de pedidos
- Reintegração manual de pedidos
- Tarefa diária automatizada para sincronização de pedidos

## Instalação

1. Clone o repositório
2. Execute `composer install` para instalar as dependências
3. Copie `.env.example` para `.env` e configure as variáveis de ambiente
4. Execute `php artisan key:generate` para gerar a chave da aplicação
5. Configure o banco de dados e execute `php artisan migrate`

## Configuração

Certifique-se de configurar as seguintes variáveis de ambiente no arquivo `.env`:

- Credenciais do Shopify
- Credenciais do Omie
- Configurações do Syngoo
- Outras configurações específicas do projeto

## Uso

- Execute `php artisan serve` para iniciar o servidor de desenvolvimento
- Acesse o painel de controle através do navegador
- Configure a tarefa cron para executar `php artisan tarefa:diaria` diariamente

## Documentação Detalhada

### resources/views/reintegrate.blade.php

Esta view Blade cria uma interface para reintegrar pedidos do Shopify.

#### Funcionalidades principais:
- Formulário para inserir o ID do pedido Shopify
- Modal para exibir o histórico de logs
- Atualização automática dos logs a cada 5 segundos
- Formatação de JSON para melhor legibilidade

#### Componentes Vue.js:
- Gerenciamento de estado para carregamento, exibição de modal e logs
- Métodos para reintegrar pedidos, buscar logs e formatar dados

#### Estilização:
- Utiliza classes do Tailwind CSS para estilização
- Animações para carregamento e destaque de novos logs

### resources/views/dashboard.blade.php

Esta view Blade cria um painel para visualizar o histórico de logs dos pedidos.

#### Funcionalidades principais:
- Filtro de logs por Shopify ID
- Exibição de logs agrupados por Shopify ID
- Atualização automática dos logs a cada 30 segundos
- Expansão/contração de detalhes dos logs

#### Componentes Vue.js:
- Gerenciamento de estado para logs, filtro e carregamento
- Métodos para buscar, formatar e exibir logs

#### Estilização:
- Utiliza classes do Tailwind CSS para layout responsivo
- Tabela para exibição organizada dos logs

### app/Console/Commands/TarefaDiaria.php

Este arquivo define um comando Artisan para executar uma tarefa diária de sincronização de pedidos.

#### Funcionalidades principais:
- Recupera pedidos aprovados dos últimos 30 dias do Shopify
- Verifica a integração com o Omie para cada pedido
- Reintegra pedidos não integrados

#### Métodos importantes:
- `handle()`: Executa a lógica principal da tarefa
- `extrairProximaUrl()`: Extrai a URL da próxima página de resultados
- `verificarIntegracaoOmie()`: Verifica se um pedido está integrado no Omie
- `reintegrarPedido()`: Reintegra um pedido não integrado

### app/Http/Controllers/OmieController.php

Este controlador gerencia as interações com a API do Omie.

#### Funcionalidades principais:
- Verificação e criação/atualização de clientes no Omie
- Criação e atualização de pedidos no Omie
- Gerenciamento de produtos e SKUs
- Envio de notificações de NFe

#### Métodos importantes:
- `checkOrder()`: Verifica se um pedido existe no Omie
- `checkClient()`: Verifica se um cliente existe no Omie
- `createClient()`: Cria um novo cliente no Omie
- `updateClient()`: Atualiza um cliente existente no Omie
- `pushOmie()`: Envia um pedido para o Omie

### app/Http/Controllers/ShopifyController.php

Este controlador gerencia as interações com a API do Shopify.

#### Funcionalidades principais:
- Criação e aprovação de pedidos
- Recuperação de detalhes de pedidos
- Reintegração de pedidos

#### Métodos importantes:
- `newOrder()`: Processa um novo pedido
- `createOrder()`: Cria um novo pedido
- `approvedOrder()`: Aprova um pedido existente
- `getShopifyId()`: Recupera o ID do Shopify para um pedido
- `reintegrateOrder()`: Reintegra um pedido existente

### app/Jobs/SendToOmie.php

Este job é responsável por enviar dados de pedidos para o Omie.

#### Funcionalidades principais:
- Verifica a existência do pedido e do cliente no Omie
- Cria ou atualiza o cliente no Omie
- Envia os dados do pedido para o Omie

#### Método principal:
- `handle()`: Executa a lógica de envio do pedido para o Omie

### app/Http/Controllers/HistoryLogController.php

Este controlador gerencia a exibição e recuperação de logs históricos.

#### Funcionalidades principais:
- Exibição inicial de logs
- Recuperação de logs filtrados por Shopify ID

#### Métodos importantes:
- `index()`: Exibe a view inicial com os últimos 50 logs
- `getLogs()`: Recupera logs filtrados ou os últimos 50 logs

### app/Http/Controllers/SyngooController.php

Este controlador gerencia o envio de mensagens através da API Syngoo.

#### Funcionalidade principal:
- Envio de mensagens via API Syngoo

#### Método principal:
- `sendMessage()`: Envia uma mensagem através da API Syngoo

### app/Http/Controllers/EstocaController.php

Este controlador gerencia atualizações de rastreamento de pedidos.

#### Funcionalidades principais:
- Processamento de atualizações de rastreamento
- Envio de notificações baseadas no status do rastreamento

#### Métodos importantes:
- `filterTracking()`: Processa atualizações de rastreamento
- `sendTrackingCode()`: Envia código de rastreamento
- `inDelivery()`: Processa status de em entrega
- `delivered()`: Processa status de entregue

### app/Jobs/ApproveOrderJob.php

Este job é responsável por aprovar um pedido no banco de dados.

#### Funcionalidade principal:
- Aprovação de um pedido no Shopify e envio para o Omie

#### Método principal:
- `handle()`: Executa a aprovação do pedido no banco de dados e dispara o job de envio para o Omie

### app/Jobs/CreateOrderJob.php

Este job é responsável por criar um novo pedido.

#### Funcionalidade principal:
- Criação de um novo pedido no sistema

#### Método principal:
- `handle()`: Executa a criação do pedido no sistema
