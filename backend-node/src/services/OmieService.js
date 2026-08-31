const axios = require('axios');
const { omieLogger } = require('../config/logger');
const { HistoryLog, Client, Order, Product } = require('../models');

class OmieService {
  constructor() {
    this.baseURL = 'https://app.omie.com.br/api/v1';
    this.credentials = {
      app_key: process.env.OMIE_AK_ES,
      app_secret: process.env.OMIE_SK_ES,
      conta: process.env.OMIE_CONTA_ES,
    };
    this.timeout = parseInt(process.env.HTTP_TIMEOUT) || 30000;
    this.retryAttempts = 3;
    this.retryDelay = 2000;
    
    // Log para verificar se as credenciais estão carregadas
    omieLogger.debug('OmieService inicializado', {
      baseURL: this.baseURL,
      app_key: this.credentials.app_key ? 'Configurado' : 'NÃO CONFIGURADO',
      app_secret: this.credentials.app_secret ? 'Configurado' : 'NÃO CONFIGURADO',
      conta: this.credentials.conta ? 'Configurado' : 'NÃO CONFIGURADO',
    });
  }

  /**
   * Verifica se o erro é esperado e não precisa de retry
   * @param {object} error 
   * @returns {boolean}
   */
  isExpectedError(error) {
    const errorMessage = error.response?.data?.faultstring || error.message;
    
    // Erros esperados que não precisam de retry
    const expectedErrors = [
      'Não existem registros',
      'Registro não encontrado',
      'Cliente não encontrado',
      'Pedido não encontrado',
      'Pedido não cadastrado para o Código de Integração', // Erro esperado
      'Cliente já cadastrado para o CPF/CNPJ', // Erro esperado - cliente existe
      'Cliente já cadastrado para o Código de Integração', // Erro esperado - cliente existe com código integração
      'não faz parte da estrutura',
      'Tag [CODIGO_PRODUTO] não faz parte',
      'O preenchimento das tags', // Erro de campo obrigatório
      'é obrigatório', // Erro de campo obrigatório
      'Estrutura inválida',
      'Parâmetro inválido'
    ];
    
    return expectedErrors.some(expectedError => 
      errorMessage.toLowerCase().includes(expectedError.toLowerCase())
    );
  }

  /**
   * Faz requisição para API do OMIE com retry inteligente
   * @param {string} endpoint 
   * @param {object} data 
   * @returns {Promise<object>}
   */
  async makeRequest(endpoint, data) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        omieLogger.debug('OMIE API Request', {
          endpoint,
          call: data.call,
          attempt,
          data: this.sanitizeLogData(data),
        });

        const response = await axios.post(`${this.baseURL}${endpoint}`, data, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        });

        omieLogger.info('OMIE API Request Success', {
          endpoint,
          call: data.call,
          attempt,
          response: response.data,
        });

        return response.data;
      } catch (error) {
        lastError = error;
        
        omieLogger.error('OMIE API Request Error', {
          endpoint,
          call: data.call,
          attempt,
          error: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });

        // Se é erro esperado, não faz retry
        if (this.isExpectedError(error)) {
          omieLogger.info('Erro esperado detectado, não fazendo retry', {
            endpoint,
            call: data.call,
            error: error.response?.data?.faultstring || error.message,
          });
          throw error;
        }

        // Se não é o último attempt e não é erro esperado, espera antes de tentar novamente
        if (attempt < this.retryAttempts) {
          omieLogger.info('Tentando novamente em alguns segundos', {
            endpoint,
            call: data.call,
            attempt,
            nextAttempt: attempt + 1,
            delay: this.retryDelay * attempt,
          });
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sanitiza dados para log (remove informações sensíveis)
   * @param {object} data 
   * @returns {object}
   */
  sanitizeLogData(data) {
    const sanitized = { ...data };
    if (sanitized.app_secret) {
      sanitized.app_secret = '***';
    }
    return sanitized;
  }

  /**
   * Adiciona delay
   * @param {number} ms 
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verifica se um pedido existe no OMIE
   * @param {string} shopifyId 
   * @returns {Promise<boolean>}
   */
  async checkOrder(shopifyId) {
    try {
      omieLogger.debug('Verificando pedido no OMIE', { shopifyId });

      // Primeiro verifica no histórico local
      const historyLog = await HistoryLog.findOne({
        where: {
          step: 17,
          shopify_id: shopifyId,
        },
      });

      if (historyLog && historyLog.log && historyLog.log.codigo_pedido) {
        await HistoryLog.create({
          step: 30,
          shopify_id: shopifyId,
          log: { status: 'ja integrado' },
        });
        
        omieLogger.info('Pedido já integrado (histórico local)', { shopifyId });
        return true;
      }

      // Consulta na API do OMIE
      const data = {
        call: 'ConsultarPedido',
        app_key: this.credentials.app_key,
        app_secret: this.credentials.app_secret,
        param: [
          {
            codigo_pedido_integracao: shopifyId,
          },
        ],
      };

      const response = await this.makeRequest('/produtos/pedido/', data);
      const pedidoEncontrado = response.pedido_venda_produto?.cabecalho?.codigo_pedido;

      await HistoryLog.create({
        step: 26,
        shopify_id: shopifyId,
        log: {
          pedido_encontrado: !!pedidoEncontrado,
          resposta_omie: response,
        },
      });

      const exists = !!pedidoEncontrado;
      omieLogger.info('Verificação de pedido concluída', { 
        shopifyId, 
        exists,
        codigoPedido: pedidoEncontrado 
      });

      return exists;
    } catch (error) {
      // Se é erro esperado (pedido não encontrado), não loga como erro
      if (this.isExpectedError(error)) {
        omieLogger.info('Pedido não encontrado no OMIE (esperado)', { 
          shopifyId,
          message: error.response?.data?.faultstring || error.message 
        });
        return false;
      }

      // Apenas loga como erro se for um erro inesperado
      omieLogger.error('Erro inesperado ao verificar pedido no OMIE', {
        shopifyId,
        error: error.message,
        response: error.response?.data,
      });
      return false;
    }
  }

  /**
   * Verifica se um cliente existe no OMIE
   * @param {string} cpfCnpj 
   * @returns {Promise<object|null>}
   */
  async checkClient(cpfCnpj) {
    try {
      omieLogger.debug('Verificando cliente no OMIE', { cpfCnpj });

      const data = {
        call: 'ListarClientes',
        app_key: this.credentials.app_key,
        app_secret: this.credentials.app_secret,
        param: [
          {
            pagina: 1,
            registros_por_pagina: 50,
            apenas_importado_api: 'N',
            clientesFiltro: [
              {
                cnpj_cpf: cpfCnpj,
              },
            ],
          },
        ],
      };

      const response = await this.makeRequest('/geral/clientes/', data);

      if (response.clientes_cadastro?.[0]) {
        // Step 59: Cliente encontrado no OMIE
        await HistoryLog.create({
          step: 59,
          shopify_id: cpfCnpj,
          log: { 
            status: 'Cliente encontrado no OMIE', 
            cliente: response.clientes_cadastro[0] 
          },
        });

        omieLogger.info('Cliente encontrado no OMIE', {
          cpfCnpj,
          codigoCliente: response.clientes_cadastro[0].codigo_cliente_omie,
        });
        return response.clientes_cadastro[0];
      }

      if (response.faultstring?.includes('Não existem registros')) {
        // Step 60: Cliente não encontrado no OMIE
        await HistoryLog.create({
          step: 60,
          shopify_id: cpfCnpj,
          log: { status: 'Cliente não encontrado no OMIE', cpf: cpfCnpj },
        });

        omieLogger.info('Cliente não encontrado no OMIE', { cpfCnpj });
        return null;
      }

      await HistoryLog.create({
        step: 61,
        shopify_id: cpfCnpj,
        log: { error: `Erro na consulta de cliente: ${response.faultstring}` },
      });

      return null;
    } catch (error) {
      // Se é erro esperado (cliente não encontrado), não loga como erro
      if (this.isExpectedError(error)) {
        omieLogger.info('Cliente não encontrado no OMIE (esperado)', { 
          cpfCnpj,
          message: error.response?.data?.faultstring || error.message 
        });
        return null;
      }

      // Apenas loga como erro se for um erro inesperado
      omieLogger.error('Erro inesperado ao verificar cliente no OMIE', {
        cpfCnpj,
        error: error.message,
        response: error.response?.data,
      });
      return null;
    }
  }

  /**
   * Cria um novo cliente no OMIE
   * @param {object} shopifyData 
   * @returns {Promise<object|null>}
   */
  async createClient(shopifyData) {
    try {
      omieLogger.debug('Criando cliente no OMIE', { 
        shopifyId: shopifyData.name,
        customerId: shopifyData.customer.id 
      });

      const clientData = await this.buildClientData(shopifyData);
      const response = await this.makeRequest('/geral/clientes/', clientData);

      // Registra resposta no histórico
      await HistoryLog.create({
        step: 62,
        shopify_id: shopifyData.name,
        log: response,
      });

      // Tratamento para erro "Cliente já cadastrado para o CPF/CNPJ"
      if (response.faultstring?.includes('Cliente já cadastrado para o CPF/CNPJ')) {
        const matches = response.faultstring.match(/Id \[(\d+)\]/);
        if (matches?.[1]) {
          const omieClientId = matches[1];
          
          omieLogger.info('Cliente já existe (CPF/CNPJ), atualizando', {
            shopifyId: shopifyData.name,
            omieClientId,
          });

          await this.updateClient(omieClientId, shopifyData);
          return { codigo_cliente_omie: omieClientId };
        }
      }

      // Tratamento para erro "Cliente já cadastrado para o Código de Integração"
      if (response.faultstring?.includes('Cliente já cadastrado para o Código de Integração')) {
        const matches = response.faultstring.match(/nCod \[(\d+)\]/);
        if (matches?.[1]) {
          const omieClientId = matches[1];
          
          omieLogger.info('Cliente já existe (Código de Integração), usando ID existente', {
            shopifyId: shopifyData.name,
            omieClientId,
            codigoIntegracao: shopifyData.customer.id,
          });

          // Registrar no histórico que o tratamento foi aplicado
          await HistoryLog.create({
            step: 69,
            shopify_id: shopifyData.name,
            log: { 
              status: 'Cliente já cadastrado - Código de Integração tratado (response)',
              omie_client_id: omieClientId,
              codigo_integracao: shopifyData.customer.id,
              faultstring: response.faultstring
            },
          });

          // Salvar relação e retornar o ID existente
          await this.saveClientRelation(omieClientId, shopifyData);
          return { codigo_cliente_omie: omieClientId };
        }
      }

      if (response.codigo_cliente_omie) {
        await this.saveClientRelation(response.codigo_cliente_omie, shopifyData);
        
        omieLogger.info('Cliente criado com sucesso', {
          shopifyId: shopifyData.name,
          omieClientId: response.codigo_cliente_omie,
        });

        return response;
      }

      if (response.httpCode === 500) {
        await HistoryLog.create({
          step: 63,
          shopify_id: shopifyData.name,
          log: { error: 'Erro 500 ao criar cliente na OMIE' },
        });
        return null;
      }

      // Step 64: Resposta inesperada ao criar cliente
      await HistoryLog.create({
        step: 64,
        shopify_id: shopifyData.name,
        log: { 
          error: 'Resposta inesperada da OMIE ao criar cliente', 
          response: response 
        },
      });

      return null;
    } catch (error) {
      // Se é erro de cliente já cadastrado, extrair ID e continuar
      if (this.isExpectedError(error) && error.response?.data?.faultstring) {
        const faultstring = error.response.data.faultstring;
        
        // Tratamento para "Cliente já cadastrado para o CPF/CNPJ"
        if (faultstring.includes('Cliente já cadastrado para o CPF/CNPJ')) {
          const idMatch = faultstring.match(/Id \[(\d+)\]/);
          
          if (idMatch && idMatch[1]) {
            const omieClientId = idMatch[1];
            
            omieLogger.info('Cliente já existe (CPF/CNPJ), usando ID existente', {
              shopifyId: shopifyData.name,
              omieClientId,
            });

            // Salvar relação e retornar o ID existente
            await this.saveClientRelation(omieClientId, shopifyData);
            
            return { codigo_cliente_omie: omieClientId };
          }
        }
        
        // Tratamento para "Cliente já cadastrado para o Código de Integração"
        if (faultstring.includes('Cliente já cadastrado para o Código de Integração')) {
          const nCodMatch = faultstring.match(/nCod \[(\d+)\]/);
          
          if (nCodMatch && nCodMatch[1]) {
            const omieClientId = nCodMatch[1];
            
            omieLogger.info('Cliente já existe (Código de Integração), usando ID existente', {
              shopifyId: shopifyData.name,
              omieClientId,
              codigoIntegracao: shopifyData.customer.id,
            });

            // Registrar no histórico que o tratamento foi aplicado
            await HistoryLog.create({
              step: 67,
              shopify_id: shopifyData.name,
              log: { 
                status: 'Cliente já cadastrado - Código de Integração tratado',
                omie_client_id: omieClientId,
                codigo_integracao: shopifyData.customer.id,
                faultstring: faultstring
              },
            });

            // Salvar relação e retornar o ID existente
            await this.saveClientRelation(omieClientId, shopifyData);
            
            return { codigo_cliente_omie: omieClientId };
          }
        }
      }

      // Capturar resposta completa do OMIE quando disponível
      const omieResponse = error.response?.data || {};
      
      omieLogger.error('Erro ao criar cliente no OMIE', {
        shopifyId: shopifyData.name,
        error: error.message,
        omie_response: omieResponse,
        faultcode: omieResponse.faultcode,
        faultstring: omieResponse.faultstring,
      });
      
      // Registrar erro no histórico com detalhes do OMIE
      await HistoryLog.create({
        step: 79,
        shopify_id: shopifyData.name,
        log: {
          error: 'Erro ao criar cliente no OMIE (catch)',
          omie_response: omieResponse,
          faultcode: omieResponse.faultcode,
          faultstring: omieResponse.faultstring,
          httpCode: omieResponse.httpCode || error.response?.status,
        },
      });
      
      return null;
    }
  }

  /**
   * Atualiza um cliente existente no OMIE
   * @param {string} omieClientId 
   * @param {object} shopifyData 
   * @returns {Promise<string|null>}
   */
  async updateClient(omieClientId, shopifyData) {
    try {
      omieLogger.debug('Atualizando cliente no OMIE', {
        shopifyId: shopifyData.name,
        omieClientId,
      });

      const clientData = await this.buildClientData(shopifyData, 'UpsertCliente');
      clientData.param[0].codigo_cliente_omie = omieClientId;

      const response = await this.makeRequest('/geral/clientes/', clientData);

      await HistoryLog.create({
        step: 65,
        shopify_id: shopifyData.name,
        log: response,
      });

      if (response.codigo_cliente_omie && response.codigo_status === '0') {
        await this.saveClientRelation(response.codigo_cliente_omie, shopifyData);
        
        omieLogger.info('Cliente atualizado com sucesso', {
          shopifyId: shopifyData.name,
          omieClientId: response.codigo_cliente_omie,
        });

        return response.codigo_cliente_omie;
      }

      if (response.codigo_status === '101' && response.codigo_cliente_omie) {
        // Cliente já cadastrado, tentar atualizar novamente
        const retryClientData = await this.buildClientData(shopifyData, 'UpsertCliente');
        retryClientData.param[0].codigo_cliente_omie = response.codigo_cliente_omie;
        const retryResponse = await this.makeRequest('/geral/clientes/', retryClientData);

        if (retryResponse.codigo_cliente_omie && retryResponse.codigo_status === '0') {
          await this.saveClientRelation(retryResponse.codigo_cliente_omie, shopifyData);
          return retryResponse.codigo_cliente_omie;
        }
      }

      omieLogger.error('Erro ao atualizar cliente na OMIE', {
        shopifyId: shopifyData.name,
        omieClientId,
        response,
      });

      return null;
    } catch (error) {
      // Se é erro de cliente já cadastrado, extrair ID e continuar
      if (this.isExpectedError(error) && error.response?.data?.faultstring) {
        const faultstring = error.response.data.faultstring;
        
        // Tratamento para "Cliente já cadastrado para o CPF/CNPJ"
        if (faultstring.includes('Cliente já cadastrado para o CPF/CNPJ')) {
          const idMatch = faultstring.match(/Id \[(\d+)\]/);
          
          if (idMatch && idMatch[1]) {
            const existingClientId = parseInt(idMatch[1]);
            
            omieLogger.info('Cliente já existe (CPF/CNPJ), usando ID existente', {
              shopifyId: shopifyData.name,
              omieClientId: existingClientId,
            });

            // Salvar relação e retornar o ID existente
            await this.saveClientRelation(existingClientId, shopifyData);
            
            return existingClientId;
          }
        }
        
        // Tratamento para "Cliente já cadastrado para o Código de Integração"
        if (faultstring.includes('Cliente já cadastrado para o Código de Integração')) {
          const nCodMatch = faultstring.match(/nCod \[(\d+)\]/);
          
          if (nCodMatch && nCodMatch[1]) {
            const existingClientId = parseInt(nCodMatch[1]);
            
            omieLogger.info('Cliente já existe (Código de Integração), usando ID existente', {
              shopifyId: shopifyData.name,
              omieClientId: existingClientId,
              codigoIntegracao: shopifyData.customer.id,
            });

            // Registrar no histórico que o tratamento foi aplicado
            await HistoryLog.create({
              step: 68,
              shopify_id: shopifyData.name,
              log: { 
                status: 'Cliente já cadastrado - Código de Integração tratado (updateClient)',
                omie_client_id: existingClientId,
                codigo_integracao: shopifyData.customer.id,
                faultstring: faultstring
              },
            });

            // Salvar relação e retornar o ID existente
            await this.saveClientRelation(existingClientId, shopifyData);
            
            return existingClientId;
          }
        }
      }

      // Capturar resposta completa do OMIE quando disponível
      const omieResponse = error.response?.data || {};
      
      omieLogger.error('Erro ao atualizar cliente no OMIE', {
        shopifyId: shopifyData.name,
        omieClientId,
        error: error.message,
        omie_response: omieResponse,
        faultcode: omieResponse.faultcode,
        faultstring: omieResponse.faultstring,
      });

      await HistoryLog.create({
        step: 66,
        shopify_id: shopifyData.name,
        log: {
          error: 'Erro ao atualizar cliente na OMIE',
          omie_response: omieResponse,
          faultcode: omieResponse.faultcode,
          faultstring: omieResponse.faultstring,
          httpCode: omieResponse.httpCode || error.response?.status,
        },
      });

      throw new Error('Erro ao atualizar cliente na OMIE');
    }
  }

  /**
   * Salva relação cliente no banco local
   * @param {string} omieClientId 
   * @param {object} shopifyData 
   */
  async saveClientRelation(omieClientId, shopifyData) {
    try {
      const cpfCnpj = await this.extractCpfCnpj(shopifyData);
      
      // Usar updateOrCreate para evitar duplicatas baseado no CPF
      await Client.findOrCreate({
        where: { cpf: cpfCnpj },
        defaults: {
          omie_client: omieClientId,
          cpf: cpfCnpj,
          shopify_client: shopifyData.customer.id,
        }
      });

      // Criar ou atualizar pedido na tabela orders
      await Order.upsert({
        shopify_id: shopifyData.name,
        omie_client: omieClientId,
        recebido: false,
        pago: false,
        nf: false,
        rastreio: false,
        saiu: false,
        entregue: false,
      });

      omieLogger.debug('Relação cliente salva', {
        omieClientId,
        shopifyId: shopifyData.name,
        cpfCnpj,
      });
    } catch (error) {
      omieLogger.error('Erro ao salvar relação cliente', {
        omieClientId,
        shopifyId: shopifyData.name,
        error: error.message,
      });
    }
  }

  /**
   * Envia pedido para o OMIE
   * @param {object} orderData 
   * @param {string} shopifyId 
   * @returns {Promise<object>}
   */
  async pushOrder(orderData, shopifyId) {
    try {
      omieLogger.debug('Enviando pedido para OMIE', { shopifyId });

      const data = {
        call: 'IncluirPedido',
        app_key: this.credentials.app_key,
        app_secret: this.credentials.app_secret,
        param: [orderData],
      };

      const response = await this.makeRequest('/produtos/pedido/', data);

      await HistoryLog.create({
        step: 17,
        shopify_id: shopifyId,
        log: response,
      });

      const codigoPedido = response.codigo_pedido || this.extractValue(
        response.faultstring,
        'Código [',
        ']'
      );

      if (codigoPedido) {
        // Atualizar pedido com omie_id usando upsert para garantir que existe
        await Order.upsert({
          shopify_id: shopifyId,
          omie_id: codigoPedido,
          recebido: false,
          pago: false,
          nf: false,
          rastreio: false,
          saiu: false,
          entregue: false,
        });

        omieLogger.info('Pedido enviado para OMIE com sucesso', {
          shopifyId,
          codigoPedido,
        });
      }

      return response;
    } catch (error) {
      // Capturar resposta completa do OMIE quando disponível
      const omieResponse = error.response?.data || {};
      
      await HistoryLog.create({
        step: 17,
        shopify_id: shopifyId,
        log: {
          error: error.message,
          omie_response: omieResponse,
          faultcode: omieResponse.faultcode,
          faultstring: omieResponse.faultstring,
          httpCode: omieResponse.httpCode || error.response?.status,
        },
      });

      omieLogger.error('Erro ao enviar pedido para OMIE', {
        shopifyId,
        error: error.message,
        omie_response: omieResponse,
        faultcode: omieResponse.faultcode,
        faultstring: omieResponse.faultstring,
      });

      throw error;
    }
  }

  /**
   * Constrói dados do cliente para envio ao OMIE
   * @param {object} shopifyData 
   * @param {string} action 
   * @returns {object}
   */
  async buildClientData(shopifyData, action = 'IncluirCliente') {
    const additionalFields = this.mapAdditionalFields(shopifyData.note_attributes || []);
    const shippingAddress = shopifyData.shipping_address || shopifyData.customer.default_address;
    const billingAddress = shopifyData.billing_address || shippingAddress;

    const cpfCnpj = await this.extractCpfCnpj(shopifyData);
    const phone = this.cleanPhone(billingAddress.phone || shippingAddress.phone);
    const phoneData = this.getPhoneData(phone);
    
    // Usar checkStreet e getCity igual ao Laravel
    const addressUtils = require('../utils/addressUtils');
    const zipcode = additionalFields.shipping_zipcode || shippingAddress.zip || '';
    const street = await addressUtils.checkStreet(
      zipcode,
      additionalFields.shipping_street || this.extractStreet(shippingAddress.address1),
      shopifyData.name // Passa shopifyId para logging
    );
    
    // Buscar cidade pelo CEP igual ao Laravel
    const cityInput = shippingAddress.city;
    const city = await addressUtils.getCityByZipcode(zipcode, cityInput, shopifyData.name);

    return {
      call: action,
      app_key: this.credentials.app_key,
      app_secret: this.credentials.app_secret,
      param: [
        {
          codigo_cliente_integracao: shopifyData.customer.id.toString(),
          email: shopifyData.customer.email,
          razao_social: shippingAddress.name || billingAddress.name,
          nome_fantasia: shippingAddress.name || billingAddress.name,
          cnpj_cpf: cpfCnpj,
          endereco: street,
          endereco_numero: additionalFields.shipping_number || this.extractNumber(shippingAddress.address1),
          complemento: additionalFields.shipping_complement || shippingAddress.address2 || '',
          bairro: additionalFields.shipping_neighborhood || shippingAddress.address2 || '',
          cidade: city,
          estado: shippingAddress.province_code,
          cep: zipcode.replace(/\D/g, ''),
          codigo_pais: '1058',
          telefone1_ddd: phoneData.ddd,
          telefone1_numero: phoneData.number,
          pessoa_fisica: cpfCnpj.length === 11 ? 'S' : 'N',
          optante_simples_nacional: 'N',
          importado_api: 'S',
          contribuinte: 'N',
          bloquear_faturamento: 'N',
          inativo: 'N',
        },
      ],
    };
  }

  /**
   * Extrai CPF/CNPJ dos dados do Shopify (usa ShopifyService com fallback para GraphQL)
   * @param {object} shopifyData 
   * @returns {Promise<string>}
   */
  async extractCpfCnpj(shopifyData) {
    const ShopifyService = require('./ShopifyService');
    const shopifyService = new ShopifyService();
    
    // Usar o método do ShopifyService que inclui busca GraphQL
    return await shopifyService.extractCpfCnpj(shopifyData);
  }

  /**
   * Limpa CPF/CNPJ removendo caracteres especiais
   * @param {string} cpfCnpj 
   * @returns {string}
   */
  cleanCpfCnpj(cpfCnpj) {
    return cpfCnpj.replace(/\D/g, '');
  }

  /**
   * Limpa telefone removendo caracteres especiais
   * @param {string} phone 
   * @returns {string}
   */
  cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  /**
   * Extrai dados do telefone (DDD e número)
   * @param {string} phone 
   * @returns {object}
   */
  getPhoneData(phone) {
    const cleaned = this.cleanPhone(phone);
    
    if (cleaned.length >= 10) {
      return {
        ddd: cleaned.substring(0, 2),
        number: cleaned.substring(2),
      };
    }

    return {
      ddd: '11',
      number: cleaned || '999999999',
    };
  }

  /**
   * Extrai endereço da string address1
   * @param {string} address1 
   * @returns {string}
   */
  extractStreet(address1) {
    if (!address1) return '';
    const parts = address1.split(',');
    return parts[0]?.trim() || '';
  }

  /**
   * Extrai número da string address1
   * @param {string} address1 
   * @returns {string}
   */
  extractNumber(address1) {
    if (!address1) return 'S/N';
    const parts = address1.split(',');
    return parts[1]?.trim() || 'S/N';
  }

  /**
   * Mapeia campos adicionais do note_attributes
   * @param {array} noteAttributes 
   * @returns {object}
   */
  mapAdditionalFields(noteAttributes) {
    const fields = {};
    
    noteAttributes.forEach(attr => {
      switch (attr.name) {
        case 'additional_cpf_cnpj':
          fields.cpf_cnpj = attr.value;
          break;
        case 'additional_info_shipping_zipcode':
          fields.shipping_zipcode = attr.value;
          break;
        case 'additional_info_shipping_province':
          fields.shipping_province = attr.value;
          break;
        case 'additional_info_shipping_city':
          fields.shipping_city = attr.value;
          break;
        case 'additional_info_shipping_neighborhood':
          fields.shipping_neighborhood = attr.value;
          break;
        case 'additional_info_shipping_complement':
          fields.shipping_complement = attr.value;
          break;
        case 'additional_info_shipping_number':
          fields.shipping_number = attr.value;
          break;
        case 'additional_info_shipping_street':
          fields.shipping_street = attr.value;
          break;
      }
    });

    return fields;
  }

  /**
   * Valida CPF/CNPJ
   * @param {string} cpfCnpj 
   * @returns {boolean}
   */
  isValidCpfCnpj(cpfCnpj) {
    if (!cpfCnpj) return false;
    
    const cleaned = this.cleanCpfCnpj(cpfCnpj);
    return cleaned.length === 11 || cleaned.length === 14;
  }

  /**
   * Determina método de envio baseado no código (seguindo padrão Laravel)
   * @param {string} shippingCode 
   * @param {string} shopifyId 
   * @returns {Promise<string>}
   */
  async getShippingMethod(shippingCode, shopifyId) {
    // Mapeamento igual ao Laravel
    const shippingMethods = {
      'FRENET_LOGGI_LOG_VIP_2': process.env.OMIE_LOGGI_ES,
      'FRENET_LOGGI_LOG_VIP': process.env.OMIE_LOGGI_ES,
      'FRENET_LOGGI_EXPRESSO_LOG_VIP': process.env.OMIE_LOGGI_ES,
      'FRENET_SEDEX__03220': process.env.OMIE_SEDEX_ES,
      'FRENET_PAC_03298': process.env.OMIE_PAC_ES,
      'FRENET_PAC_04510_BACKUP': process.env.OMIE_PAC_ES,
    };

    const method = shippingMethods[shippingCode];

    if (method) {
      return method;
    }

    // Step 25: Transportadora não reconhecida
    await HistoryLog.create({
      step: 25,
      shopify_id: shopifyId,
      log: { status: `Transportadora não reconhecida: ${shippingCode}` },
    });

    omieLogger.warn('Transportadora não reconhecida', {
      shippingCode,
      shopifyId,
    });

    // Usar LOGGI como padrão (igual ao Laravel)
    return process.env.OMIE_LOGGI_ES || '123456';
  }

  /**
   * Extrai valor entre delimitadores
   * @param {string} string 
   * @param {string} startDelim 
   * @param {string} endDelim 
   * @returns {string|null}
   */
  extractValue(string, startDelim, endDelim) {
    if (!string) return null;
    
    const startPos = string.indexOf(startDelim);
    if (startPos === -1) return null;
    
    const valueStart = startPos + startDelim.length;
    const endPos = string.indexOf(endDelim, valueStart);
    if (endPos === -1) return null;
    
    return string.substring(valueStart, endPos);
  }

  /**
   * Define tempo de faturamento seguindo padrão Laravel
   * @returns {string}
   */
  setBillingTime() {
    const now = new Date();
    
    // Se for antes das 18h, usa hoje; senão usa amanhã (igual ao Laravel)
    if (now.getHours() >= 18) {
      now.setDate(now.getDate() + 1);
    }
    
    // Formato dd/mm/yyyy igual ao Laravel
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  /**
   * Busca produto por SKU na API do OMIE
   * @param {string} sku 
   * @returns {Promise<object|null>}
   */
  async getProductBySku(sku) {
    try {
      omieLogger.debug('Buscando produto no OMIE', { sku });

      const data = {
        call: 'ConsultarProduto',
        app_key: this.credentials.app_key,
        app_secret: this.credentials.app_secret,
        param: [
          {
            codigo: sku,
          },
        ],
      };

      const response = await this.makeRequest('/geral/produtos/', data);
      
      omieLogger.info('Produto encontrado no OMIE', { 
        sku, 
        codigoProduto: response.codigo_produto 
      });

      return response;
    } catch (error) {
      if (this.isExpectedError(error)) {
        omieLogger.info('Produto não encontrado no OMIE (esperado)', { 
          sku,
          message: error.response?.data?.faultstring || error.message 
        });
        return null;
      }

      omieLogger.error('Erro inesperado ao buscar produto no OMIE', {
        sku,
        error: error.message,
        response: error.response?.data,
      });
      return null;
    }
  }
}

module.exports = OmieService; 