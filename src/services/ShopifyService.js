const axios = require('axios');
const { logger } = require('../config/logger');

class ShopifyService {
  constructor() {
    this.baseURL = process.env.SHOPIFY_URL;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2023-10';
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.timeout = parseInt(process.env.HTTP_TIMEOUT) || 30000;
  }

  /**
   * Faz requisição para API do Shopify
   * @param {string} endpoint 
   * @param {string} method 
   * @param {object} data 
   * @returns {Promise<object>}
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}/admin/api/${this.apiVersion}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      logger.debug('Shopify API Request', {
        endpoint,
        method,
        url: config.url,
      });

      const response = await axios(config);

      logger.info('Shopify API Request Success', {
        endpoint,
        method,
        status: response.status,
      });

      return response.data;
    } catch (error) {
      logger.error('Shopify API Request Error', {
        endpoint,
        method,
        error: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Busca pedidos aprovados por período
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {Promise<array>}
   */
  async getOrdersByDateRange(startDate, endDate) {
    try {
      const allOrders = [];
      let url = `/orders.json?status=any&financial_status=paid&created_at_min=${startDate}&created_at_max=${endDate}&order=created_at asc&limit=250`;

      while (url) {
        const response = await this.makeRequest(url);
        allOrders.push(...response.orders);

        // Verifica se há próxima página
        const linkHeader = response.headers?.link;
        url = this.extractNextUrl(linkHeader);
      }

      logger.info('Pedidos Shopify recuperados', {
        startDate,
        endDate,
        total: allOrders.length,
      });

      return allOrders;
    } catch (error) {
      logger.error('Erro ao buscar pedidos Shopify', {
        startDate,
        endDate,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Busca detalhes de um pedido específico
   * @param {string} orderId 
   * @returns {Promise<object>}
   */
  async getOrderDetails(orderId) {
    try {
      const response = await this.makeRequest(`/orders/${orderId}.json`);
      
      logger.debug('Detalhes do pedido Shopify recuperados', {
        orderId,
        name: response.order.name,
      });

      return response.order;
    } catch (error) {
      logger.error('Erro ao buscar detalhes do pedido Shopify', {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Busca pedido por nome
   * @param {string} orderName 
   * @returns {Promise<object|null>}
   */
  async getOrderByName(orderName) {
    try {
      const response = await this.makeRequest(`/orders.json?name=${orderName}&limit=1`);
      
      if (response.orders && response.orders.length > 0) {
        logger.debug('Pedido encontrado por nome', {
          orderName,
          orderId: response.orders[0].id,
        });
        return response.orders[0];
      }

      logger.info('Pedido não encontrado por nome', { orderName });
      return null;
    } catch (error) {
      logger.error('Erro ao buscar pedido por nome', {
        orderName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Atualiza tags de um pedido
   * @param {string} orderId 
   * @param {string} tags 
   * @returns {Promise<object>}
   */
  async updateOrderTags(orderId, tags) {
    try {
      const data = {
        order: {
          id: orderId,
          tags: tags,
        },
      };

      const response = await this.makeRequest(`/orders/${orderId}.json`, 'PUT', data);
      
      logger.info('Tags do pedido atualizadas', {
        orderId,
        tags,
      });

      return response.order;
    } catch (error) {
      logger.error('Erro ao atualizar tags do pedido', {
        orderId,
        tags,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Busca informações do cliente
   * @param {string} customerId 
   * @returns {Promise<object>}
   */
  async getCustomer(customerId) {
    try {
      const response = await this.makeRequest(`/customers/${customerId}.json`);
      
      logger.debug('Cliente Shopify recuperado', {
        customerId,
        email: response.customer.email,
      });

      return response.customer;
    } catch (error) {
      logger.error('Erro ao buscar cliente Shopify', {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Extrai URL da próxima página do header Link
   * @param {string} linkHeader 
   * @returns {string|null}
   */
  extractNextUrl(linkHeader) {
    if (!linkHeader) return null;
    
    const match = linkHeader.match(/<([^>]*)>;\s*rel="next"/);
    if (match && match[1]) {
      // Remove a base URL para manter apenas o endpoint
      const fullUrl = match[1];
      const baseUrl = `${this.baseURL}/admin/api/${this.apiVersion}`;
      return fullUrl.replace(baseUrl, '');
    }
    
    return null;
  }

  /**
   * Extrai CPF/CNPJ de um pedido Shopify
   * @param {object} order 
   * @returns {Promise<string>}
   */
  async extractCpfCnpj(order) {
    // Verifica note_attributes
    if (order.note_attributes) {
      for (const attr of order.note_attributes) {
        if (attr.name === 'additional_cpf_cnpj' && attr.value) {
          return this.cleanCpfCnpj(attr.value);
        }
      }
    }

    // Verifica billing_address.company
    if (order.billing_address?.company) {
      return this.cleanCpfCnpj(order.billing_address.company);
    }

    // Verifica shipping_address.company
    if (order.shipping_address?.company) {
      return this.cleanCpfCnpj(order.shipping_address.company);
    }

    // Se não encontrou nos campos tradicionais, busca nas localizationExtensions
    const cpfFromGraphQL = await this.getCpfCnpjFromGraphQL(order.id);
    if (cpfFromGraphQL) {
      return this.cleanCpfCnpj(cpfFromGraphQL);
    }

    return '';
  }

  /**
   * Busca CPF/CNPJ usando GraphQL API nas localizationExtensions
   * @param {string|number} orderId 
   * @returns {Promise<string|null>}
   */
  async getCpfCnpjFromGraphQL(orderId) {
    try {
      logger.debug('Buscando CPF/CNPJ via GraphQL', { orderId });

      const query = {
        query: `query { 
          order(id: "gid://shopify/Order/${orderId}") { 
            name 
            localizationExtensions(first: 10) { 
              nodes { 
                purpose 
                countryCode 
                title 
                value 
              } 
            } 
          } 
        }`
      };

      const response = await axios.post(
        `${this.baseURL}/admin/api/${this.apiVersion}/graphql.json`,
        query,
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          timeout: this.timeout,
        }
      );

      logger.debug('GraphQL API Request Success', {
        orderId,
        status: response.status,
      });

      const orderData = response.data?.data?.order;
      const localizationExtensions = orderData?.localizationExtensions?.nodes;

      if (localizationExtensions && localizationExtensions.length > 0) {
        // Busca o primeiro valor disponível nas localizationExtensions
        const cpfExtension = localizationExtensions.find(node => node.value);
        
        if (cpfExtension && cpfExtension.value) {
          logger.info('CPF/CNPJ encontrado via GraphQL', {
            orderId,
            orderName: orderData.name,
            cpfCnpj: cpfExtension.value,
          });
          
          return cpfExtension.value;
        }
      }

      logger.info('CPF/CNPJ não encontrado nas localizationExtensions', { orderId });
      return null;

    } catch (error) {
      logger.error('Erro ao buscar CPF/CNPJ via GraphQL', {
        orderId,
        error: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });
      
      // Retorna null em caso de erro para não quebrar o fluxo
      return null;
    }
  }

  /**
   * Limpa CPF/CNPJ removendo caracteres especiais
   * @param {string} cpfCnpj 
   * @returns {string}
   */
  cleanCpfCnpj(cpfCnpj) {
    if (!cpfCnpj) return '';
    return cpfCnpj.replace(/\D/g, '');
  }

  /**
   * Valida se é um CPF/CNPJ válido
   * @param {string} cpfCnpj 
   * @returns {boolean}
   */
  isValidCpfCnpj(cpfCnpj) {
    if (!cpfCnpj) return false;
    
    const cleaned = this.cleanCpfCnpj(cpfCnpj);
    return cleaned.length === 11 || cleaned.length === 14;
  }

  /**
   * Formata dados do pedido para processamento
   * @param {object} order 
   * @returns {object}
   */
  formatOrderData(order) {
    return {
      id: order.id,
      name: order.name,
      email: order.email || order.customer?.email,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      total_price: order.total_price,
      currency: order.currency,
      created_at: order.created_at,
      updated_at: order.updated_at,
      customer: order.customer,
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      line_items: order.line_items,
      shipping_lines: order.shipping_lines,
      note_attributes: order.note_attributes,
      tags: order.tags,
      order_status_url: order.order_status_url,
      total_shipping_price_set: order.total_shipping_price_set,
    };
  }

  /**
   * Verifica se um pedido está pago
   * @param {object} order 
   * @returns {boolean}
   */
  isOrderPaid(order) {
    return order.financial_status === 'paid';
  }

  /**
   * Verifica se um pedido foi cancelado
   * @param {object} order 
   * @returns {boolean}
   */
  isOrderCancelled(order) {
    return order.cancelled_at !== null;
  }

  /**
   * Extrai informações de frete
   * @param {object} order 
   * @returns {object}
   */
  getShippingInfo(order) {
    const shippingLine = order.shipping_lines?.[0];
    
    return {
      method: shippingLine?.title || 'Não especificado',
      code: shippingLine?.code || 'LOGGI',
      price: order.total_shipping_price_set?.shop_money?.amount || '0.00',
      carrier_identifier: shippingLine?.carrier_identifier,
      requested_fulfillment_service_id: shippingLine?.requested_fulfillment_service_id,
    };
  }

  /**
   * Calcula total de itens no pedido
   * @param {object} order 
   * @returns {number}
   */
  getTotalItems(order) {
    if (!order.line_items || !Array.isArray(order.line_items)) {
      return 0;
    }

    return order.line_items.reduce((total, item) => {
      return total + (item.quantity || 0);
    }, 0);
  }

  /**
   * Extrai SKUs dos itens do pedido
   * @param {object} order 
   * @returns {array}
   */
  extractSkus(order) {
    if (!order.line_items || !Array.isArray(order.line_items)) {
      return [];
    }

    return order.line_items.map(item => ({
      sku: item.sku || item.variant_id?.toString(),
      title: item.title,
      variant_title: item.variant_title,
      quantity: item.quantity,
      price: item.price,
      total_discount: item.total_discount,
      product_id: item.product_id,
      variant_id: item.variant_id,
    }));
  }
}

module.exports = ShopifyService; 