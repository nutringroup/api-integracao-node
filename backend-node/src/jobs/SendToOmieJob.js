const { logger } = require('../config/logger');
const OmieService = require('../services/OmieService');
const ShopifyService = require('../services/ShopifyService');
const { HistoryLog, Order, ManualOrder } = require('../models');
const { queueLogger } = require('../config/logger');

class SendToOmieJob {
  constructor() {
    this.omieService = new OmieService();
    this.shopifyService = new ShopifyService();
  }

  /**
   * Processa o job de envio para OMIE
   * @param {object} job 
   * @returns {Promise<object>}
   */
  async process(job) {
    const { shopifyData } = job.data;
    const shopifyId = shopifyData.name;

    try {
      queueLogger.info('Iniciando processamento do pedido para OMIE', {
        shopifyId,
        jobId: job.id,
        customerEmail: shopifyData.customer?.email,
      });

      // Criar registro inicial do pedido na tabela orders
      await this.createInitialOrder(shopifyData);

      // Verifica se o pedido já existe no OMIE
      const orderExists = await this.omieService.checkOrder(shopifyId);
      if (orderExists) {
        await HistoryLog.create({
          step: 8,
          shopify_id: shopifyId,
          log: { status: 'Pedido já integrado' },
        });
        
        queueLogger.info('Pedido já integrado no OMIE', { shopifyId });
        return { status: 'already_integrated' };
      }

      // Recupera e valida CPF/CNPJ do cliente
      const cpfCnpj = await this.getCpfCnpj(shopifyData);
      if (!this.omieService.isValidCpfCnpj(cpfCnpj)) {
        await HistoryLog.create({
          step: 9,
          shopify_id: shopifyId,
          log: { status: 'CPF ou CNPJ inválido', cpf_cnpj: cpfCnpj },
        });
        throw new Error(`CPF ou CNPJ inválido: ${cpfCnpj}`);
      }

      // Verifica se o cliente já existe no OMIE
      let omieClient = await this.omieService.checkClient(cpfCnpj);
      let omieClientId;

      if (omieClient) {
        // Atualiza cliente existente
        try {
          omieClientId = await this.omieService.updateClient(
            omieClient.codigo_cliente_omie,
            shopifyData
          );
          
          if (!omieClientId) {
            throw new Error('Erro ao atualizar cliente na OMIE');
          }
        } catch (error) {
          // Se erro é de cliente já cadastrado, extrair ID e continuar igual ao Laravel
          if (error.message.includes('Cliente já cadastrado')) {
            queueLogger.info('Cliente já existe no OMIE, continuando com ID existente', {
              shopifyId,
              omieClientId: omieClient.codigo_cliente_omie,
            });
            
            // Usar o ID do cliente que já existe
            omieClientId = omieClient.codigo_cliente_omie;
            
            // Salvar relação no banco
            await this.omieService.saveClientRelation(omieClientId, shopifyData);
          } else {
                      // Capturar resposta completa do OMIE quando disponível
          const omieResponse = error.response?.data || {};
          
          await HistoryLog.create({
            step: 10,
            shopify_id: shopifyId,
            log: { 
              status: 'Erro ao atualizar o cliente na OMIE', 
              error: error.message,
              omie_response: omieResponse,
              faultcode: omieResponse.faultcode,
              faultstring: omieResponse.faultstring,
              httpCode: omieResponse.httpCode || error.response?.status,
            },
          });
            throw error;
          }
        }
      } else {
        // Cria novo cliente
        const clientResponse = await this.omieService.createClient(shopifyData);
        if (!clientResponse || !clientResponse.codigo_cliente_omie) {
                  await HistoryLog.create({
          step: 11,
          shopify_id: shopifyId,
          log: { 
            status: 'Erro ao criar cliente na OMIE',
            error: 'Cliente não foi criado - resposta inválida'
          },
        });
          throw new Error('Erro ao criar cliente na OMIE');
        }
        omieClientId = clientResponse.codigo_cliente_omie;
      }

      // Prepara dados do pedido
      const orderData = await this.buildOrderData(shopifyData, omieClientId);

      // Envia pedido para OMIE
      const response = await this.omieService.pushOrder(orderData, shopifyId);

      queueLogger.info('Pedido enviado para OMIE com sucesso', {
        shopifyId,
        omieOrderId: response.codigo_pedido,
        omieClientId,
        jobId: job.id,
      });

      return {
        status: 'success',
        omie_order_id: response.codigo_pedido,
        omie_client_id: omieClientId,
      };

    } catch (error) {
      queueLogger.error('Erro ao processar pedido para OMIE', {
        shopifyId,
        jobId: job.id,
        error: error.message,
        stack: error.stack,
      });

      // Capturar resposta completa do OMIE quando disponível
      const omieResponse = error.response?.data || {};
      
      await HistoryLog.create({
        step: 99,
        shopify_id: shopifyId,
        log: {
          status: 'Erro no processamento',
          error: error.message,
          job_id: job.id,
          omie_response: omieResponse,
          faultcode: omieResponse.faultcode,
          faultstring: omieResponse.faultstring,
          httpCode: omieResponse.httpCode || error.response?.status,
        },
      });

      throw error;
    }
  }

  /**
   * Constrói dados do pedido para envio ao OMIE
   * @param {object} shopifyData 
   * @param {string} omieClientId 
   * @returns {Promise<object>}
   */
  async buildOrderData(shopifyData, omieClientId) {
    try {
      queueLogger.debug('Construindo dados do pedido para OMIE', {
        shopifyId: shopifyData.name,
        omieClientId,
      });

      const additionalFields = this.mapAdditionalFields(shopifyData.note_attributes || []);
      const shippingAddress = shopifyData.shipping_address || shopifyData.customer.default_address;
      
      // Debug: Log para verificar dados do endereço
      console.log('=== DEBUG SHIPPING ADDRESS ===');
      console.log('shopifyData.shipping_address:', JSON.stringify(shopifyData.shipping_address, null, 2));
      console.log('shopifyData.billing_address:', JSON.stringify(shopifyData.billing_address, null, 2));
      console.log('shippingAddress:', JSON.stringify(shippingAddress, null, 2));
      console.log('shippingAddress.name:', shippingAddress?.name);
      console.log('shopifyData.billing_address?.name:', shopifyData.billing_address?.name);
      console.log('==============================');
      
      const shippingInfo = this.shopifyService.getShippingInfo(shopifyData);
      
      // Determina método de envio
      const shippingMethod = await this.omieService.getShippingMethod(
        shippingInfo.code,
        shopifyData.name
      );

      // Calcula data de previsão
      const estimatedTime = this.omieService.setBillingTime();

      // Processa itens do pedido
      const lineItems = await this.processLineItems(shopifyData);
      const totalQty = lineItems.length;

      // Ajusta preços de produtos zerados
      const adjustedLineItems = await this.adjustZeroPriceProducts(lineItems, shopifyData);

      // Dados de endereço de entrega
      const deliveryAddress = await this.buildDeliveryAddress(shopifyData, additionalFields);

      // Monta estrutura do pedido
      const orderData = {
        informacoes_adicionais: {
          enviar_email: 'N',
          consumidor_final: 'S',
          codigo_categoria: '1.01.01',
          codigo_conta_corrente: process.env.OMIE_CONTA_ES,
          numero_pedido_cliente: shopifyData.name,
          contato: shippingAddress.name || shopifyData.billing_address?.name || '',
          outros_detalhes: deliveryAddress,
        },
        
        // Debug: Log do campo contato final
        ...((() => {
          const contatoValue = shippingAddress.name || shopifyData.billing_address?.name || '';
          console.log('=== DEBUG CONTATO FINAL ===');
          console.log('Valor do campo contato:', contatoValue);
          console.log('===========================');
          return {};
        })()),
        cabecalho: {
          codigo_cliente: omieClientId,
          codigo_pedido_integracao: shopifyData.name,
          etapa: '50',
          quantidade_itens: totalQty,
          data_previsao: estimatedTime,
        },
        frete: {
          modalidade: '0',
          valor_frete: shippingInfo.price,
          quantidade_volumes: '1',
          especie_volumes: 'Caixas',
          codigo_transportadora: shippingMethod,
        },
        det: adjustedLineItems,
      };

      queueLogger.debug('Dados do pedido construídos', {
        shopifyId: shopifyData.name,
        totalItens: totalQty,
        valorFrete: shippingInfo.price,
        transportadora: shippingMethod,
      });

      return orderData;
    } catch (error) {
      queueLogger.error('Erro ao construir dados do pedido', {
        shopifyId: shopifyData.name,
        omieClientId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Constrói endereço de entrega seguindo padrão do Laravel
   * @param {object} shopifyData 
   * @param {object} additionalFields 
   * @returns {Promise<object>}
   */
  async buildDeliveryAddress(shopifyData, additionalFields) {
    const shippingAddress = shopifyData.shipping_address || shopifyData.customer.default_address;
    const zipcode = additionalFields.shipping_zipcode || shippingAddress.zip || '';
    
    // Usar checkStreet igual ao Laravel
    const addressUtils = require('../utils/addressUtils');
    const street = await addressUtils.checkStreet(
      zipcode,
      additionalFields.shipping_street || this.omieService.extractStreet(shippingAddress.address1),
      shopifyData.name // Passa shopifyId para logging
    );
    
    // Buscar cidade pelo CEP igual ao Laravel e OmieService
    const cityInput = shippingAddress.city;
    const city = await addressUtils.getCityByZipcode(zipcode, cityInput, shopifyData.name);
    
    // CPF/CNPJ seguindo lógica exata do Laravel
    const cpfCnpjForDelivery = this.getCpfCnpjForDelivery(shopifyData, additionalFields);
    
    return {
      cBairroOd: additionalFields.shipping_neighborhood || shippingAddress.address2 || '',
      cCEPOd: zipcode.replace(/\D/g, ''),
      cCidadeOd: city, // Usar cidade normalizada das APIs de CEP, sem province_code
      cCnpjCpfOd: cpfCnpjForDelivery,
      cEnderecoOd: street,
      cEstadoOd: shippingAddress.province_code,
      cNumeroOd: additionalFields.shipping_number || this.omieService.extractNumber(shippingAddress.address1),
      cComplementoOd: additionalFields.shipping_complement || shippingAddress.address2 || '',
      cNomeOd: shippingAddress.name || shopifyData.billing_address?.name || ''
    };
  }

  /**
   * Processa itens do pedido seguindo o padrão do Laravel
   * @param {object} shopifyData 
   * @returns {array}
   */
  async processLineItems(shopifyData) {
    const lineItems = [];
    
    if (!shopifyData.line_items || !Array.isArray(shopifyData.line_items)) {
      return lineItems;
    }

    // SKU mapping igual ao Laravel
    const skuMapping = {
      'CBGH448': 'CBGH614',
      'CBGH449': 'CBGH615',
      'CBGH450': 'CBGH616',
      'CBGH451': 'CBGH617',
      'CBGH18': 'KGH003',
      'CBGH481': 'CBGH677',
      'CBGH334': 'CBGH677',
      'CBGH280': 'CBGH680',
      'CBGH337': 'CBGH681',
      'CBGH338': 'CBGH682',
      'CHGH647': 'CBGH647',
      'CBGH732': 'CBGH750',
      'CBGH733': 'CBGH752',
      'CBGH644': 'CBGH590',
      'CBGH645': 'CBGH591',
      'CBGH646': 'CBGH593',
      'CBGH647': 'CBGH592',
      'CBGH720': 'CBGH594',
    };

    // Pedidos especiais igual ao Laravel
    const pedidosEspeciais = [
      '643398', '643401', '643409', '643411', '643427', '643013', '643053', '643079',
      '642634', '642655', '642681', '642689', '642860', '642866', '642900', '642956',
      '642965', '642980', '642225', '642228', '642264', '642267', '642270', '642390',
      '642391', '642424', '642458', '642463', '642467', '642485', '642504', '642543',
      '642566', '642575', '642577', '642599', '641827', '641837', '641860', '641898',
      '641938', '641952', '641978', '641983', '642007', '642020', '642036', '642080',
      '642085', '642200', '642204', '642213', '641213', '641227', '641239', '641248',
      '641270', '641272', '641278', '641292', '641303', '641305', '641340', '641413',
      '641416', '641417', '641433', '641507', '641522', '641525', '641545', '641588',
      '641603', '641614', '641653', '641656', '641671', '641713', '641753', '641763',
      '641801'
    ];

    if (pedidosEspeciais.includes(shopifyData.name)) {
      skuMapping['CBGH663'] = 'CBGH669';
      skuMapping['CBGH664'] = 'CBGH670';
      skuMapping['CBGH665'] = 'CBGH671';
      skuMapping['CBGH666'] = 'CBGH672';
      skuMapping['CBGH701'] = 'CBGH708';
    }

    for (let index = 0; index < shopifyData.line_items.length; index++) {
      const item = shopifyData.line_items[index];
      let sku = item.sku || item.variant_id?.toString() || `ITEM_${index + 1}`;
      
      // Regra especial para "6 Gummy kids Frutas" usar SKU "KGK006"
      if (item.name && item.name.includes('6 Gummy kids Frutas')) {
        const originalSku = sku;
        sku = 'KGK006';
        
        // Step 75: Regra especial aplicada
        await HistoryLog.create({
          step: 75,
          shopify_id: shopifyData.name,
          log: { 
            status: 'Regra especial aplicada: 6 Gummy kids Frutas',
            original_sku: originalSku,
            new_sku: sku,
            product_name: item.name 
          },
        });

        queueLogger.debug('Aplicada regra especial para 6 Gummy kids Frutas', {
          shopifyId: shopifyData.name,
          originalSku,
          newSku: sku,
          productName: item.name,
        });
      } else {
        // Aplicar mapeamento de SKU normal
        sku = skuMapping[sku] || sku;
      }
      
      const quantity = item.quantity || 1;
      const unitPrice = parseFloat(item.price) || 0;
      
      // Calcular desconto corretamente - somar TODOS os descontos aplicados
      let totalDiscount = 0;
      if (item.discount_allocations && item.discount_allocations.length > 0) {
        // Somar todos os descontos em vez de apenas o primeiro
        totalDiscount = item.discount_allocations.reduce((sum, allocation) => {
          const discountAmount = parseFloat(allocation.amount_set.shop_money.amount) || 0;
          return sum + discountAmount;
        }, 0);
        
        // Log para debug quando múltiplos descontos são aplicados
        if (item.discount_allocations.length > 1) {
          await HistoryLog.create({
            step: 78,
            shopify_id: shopifyData.name,
            log: { 
              status: 'Múltiplos descontos aplicados ao item',
              item_name: item.name,
              item_sku: sku,
              total_discounts: item.discount_allocations.length,
              discount_details: item.discount_allocations.map(allocation => ({
                amount: allocation.amount_set.shop_money.amount,
                discount_application_index: allocation.discount_application_index
              })),
              total_discount_amount: totalDiscount
            },
          });
          
          queueLogger.info('Múltiplos descontos aplicados ao item', {
            shopifyId: shopifyData.name,
            itemName: item.name,
            itemSku: sku,
            totalDiscounts: item.discount_allocations.length,
            totalDiscountAmount: totalDiscount,
          });
        }
      }

      // Buscar produto no banco ou na API do OMIE igual ao Laravel
      let productCode;
      let productIntegrationCode = null;
      
      try {
        // Buscar produto no banco de dados local
        const { Product, HistoryLog } = require('../models');
        const product = await Product.findOne({ 
          where: { sku, uf: 'ES' } 
        });

        if (product) {
          // Step 70: Produto encontrado no banco local
          await HistoryLog.create({
            step: 70,
            shopify_id: shopifyData.name,
            log: { 
              status: 'Produto encontrado no banco local', 
              sku, 
              id_produto: product.id_produto 
            },
          });

          productCode = product.id_produto;
          productIntegrationCode = product.codigo_produto_integracao;
        } else {
          // Step 71: Produto não encontrado no banco local
          await HistoryLog.create({
            step: 71,
            shopify_id: shopifyData.name,
            log: { status: 'Produto não encontrado no banco local', sku },
          });

          // Buscar na API do OMIE igual ao Laravel
          const omieProduct = await this.omieService.getProductBySku(sku);
          
          if (omieProduct && omieProduct.codigo_produto) {
            // Step 72: Produto encontrado na API OMIE
            await HistoryLog.create({
              step: 72,
              shopify_id: shopifyData.name,
              log: { 
                status: 'Produto encontrado na API OMIE', 
                sku, 
                codigo_produto: omieProduct.codigo_produto 
              },
            });

            productCode = omieProduct.codigo_produto;
            
            // Salvar no banco para próximas consultas
            await Product.upsert({
              sku,
              uf: 'ES',
              id_produto: omieProduct.codigo_produto,
              codigo_produto_integracao: omieProduct.codigo_produto_integracao || null,
            });
          } else {
            // Step 73: Produto não encontrado na API OMIE
            await HistoryLog.create({
              step: 73,
              shopify_id: shopifyData.name,
              log: { status: 'Produto não encontrado na API OMIE', sku },
            });

            throw new Error(`Produto ${sku} não encontrado no OMIE`);
          }
        }
      } catch (error) {
        // Step 74: Erro ao buscar produto
        await HistoryLog.create({
          step: 74,
          shopify_id: shopifyData.name,
          log: { 
            status: 'Erro ao buscar produto', 
            sku, 
            error: error.message 
          },
        });

        queueLogger.error('Erro ao buscar produto', { sku, error: error.message });
        
        // Usar SKU como fallback (pode dar erro na API)
        productCode = sku;
        productIntegrationCode = null;
      }

      lineItems.push({
        ide: {
          codigo_item_integracao: index,
        },
        produto: {
          codigo_produto: productCode,
          codigo_produto_integracao: productIntegrationCode,
          quantidade: quantity,
          valor_unitario: unitPrice,
          valor_desconto: totalDiscount,
          tipo_desconto: 'V',
        },
      });
    }

    return lineItems;
  }

  /**
   * Ajusta preços de produtos zerados seguindo regra de negócio
   * @param {array} lineItems - Array de line items processados
   * @param {object} shopifyData - Dados originais do Shopify
   * @returns {array} - Line items com preços ajustados
   */
  async adjustZeroPriceProducts(lineItems, shopifyData) {
    const ZERO_PRICE_REPLACEMENT = 16.50;
    const zeroProductsCount = lineItems.filter(item => item.produto.valor_unitario === 0).length;
    
    if (zeroProductsCount === 0) {
      return lineItems; // Nenhum produto com preço zero
    }

    const totalZeroAdjustment = zeroProductsCount * ZERO_PRICE_REPLACEMENT;
    
    // Log do ajuste
    await HistoryLog.create({
      step: 76,
      shopify_id: shopifyData.name,
      log: { 
        status: 'Ajuste de produtos com preço zero iniciado',
        produtos_zerados: zeroProductsCount,
        valor_substituicao: ZERO_PRICE_REPLACEMENT,
        total_ajuste: totalZeroAdjustment
      },
    });

    queueLogger.info('Ajustando produtos com preço zero', {
      shopifyId: shopifyData.name,
      produtosZerados: zeroProductsCount,
      valorSubstituicao: ZERO_PRICE_REPLACEMENT,
      totalAjuste: totalZeroAdjustment,
    });

    // Encontrar produtos com preço maior que zero para distribuir o desconto
    const nonZeroProducts = lineItems.filter(item => item.produto.valor_unitario > 0);
    
    if (nonZeroProducts.length === 0) {
      // Todos os produtos têm preço zero - apenas define o preço padrão
      lineItems.forEach(item => {
        if (item.produto.valor_unitario === 0) {
          item.produto.valor_unitario = ZERO_PRICE_REPLACEMENT;
        }
      });

      await HistoryLog.create({
        step: 77,
        shopify_id: shopifyData.name,
        log: { 
          status: 'Todos os produtos tinham preço zero - aplicado preço padrão',
          valor_aplicado: ZERO_PRICE_REPLACEMENT
        },
      });

      return lineItems;
    }

    // Calcular total dos produtos com preço válido
    const totalNonZeroValue = nonZeroProducts.reduce((total, item) => {
      return total + (item.produto.valor_unitario * item.produto.quantidade);
    }, 0);

    // Definir preço para produtos zerados
    lineItems.forEach(item => {
      if (item.produto.valor_unitario === 0) {
        item.produto.valor_unitario = ZERO_PRICE_REPLACEMENT;
      }
    });

    // Distribuir o desconto proporcionalmente entre produtos com preço válido
    let remainingAdjustment = totalZeroAdjustment;
    
    for (let i = 0; i < nonZeroProducts.length; i++) {
      const item = nonZeroProducts[i];
      const itemTotalValue = item.produto.valor_unitario * item.produto.quantidade;
      
      // Calcular proporção do desconto para este item
      let itemAdjustment;
      if (i === nonZeroProducts.length - 1) {
        // Último item recebe o restante para evitar problemas de arredondamento
        itemAdjustment = remainingAdjustment;
      } else {
        itemAdjustment = (itemTotalValue / totalNonZeroValue) * totalZeroAdjustment;
        itemAdjustment = Math.round(itemAdjustment * 100) / 100; // Arredondar para 2 casas decimais
      }

      // Aplicar o desconto
      const currentDiscount = item.produto.valor_desconto || 0;
      item.produto.valor_desconto = currentDiscount + itemAdjustment;
      item.produto.tipo_desconto = 'V'; // Valor absoluto
      
      remainingAdjustment -= itemAdjustment;

      queueLogger.debug('Desconto aplicado ao produto', {
        shopifyId: shopifyData.name,
        codigoProduto: item.produto.codigo_produto,
        valorUnitario: item.produto.valor_unitario,
        quantidade: item.produto.quantidade,
        descontoAnterior: currentDiscount,
        descontoAplicado: itemAdjustment,
        descontoTotal: item.produto.valor_desconto,
      });
    }

    // Log final do ajuste
    await HistoryLog.create({
      step: 78,
      shopify_id: shopifyData.name,
      log: { 
        status: 'Ajuste de produtos com preço zero concluído',
        produtos_ajustados: zeroProductsCount,
        produtos_com_desconto: nonZeroProducts.length,
        total_desconto_distribuido: totalZeroAdjustment
      },
    });

    queueLogger.info('Ajuste de produtos com preço zero concluído', {
      shopifyId: shopifyData.name,
      produtosAjustados: zeroProductsCount,
      produtosComDesconto: nonZeroProducts.length,
      totalDescontoDistribuido: totalZeroAdjustment,
    });

    return lineItems;
  }

  /**
   * Obtém CPF/CNPJ do cliente seguindo padrão do Laravel (com fallback GraphQL)
   * @param {object} shopifyData 
   * @returns {Promise<string>}
   */
  async getCpfCnpj(shopifyData) {
    // Usar o método do OmieService que agora inclui busca GraphQL
    return await this.omieService.extractCpfCnpj(shopifyData);
  }

  /**
   * Obtém CPF/CNPJ para o campo cCnpjCpfOd seguindo lógica do Laravel
   * @param {object} shopifyData 
   * @param {object} additionalFields 
   * @returns {string}
   */
  getCpfCnpjForDelivery(shopifyData, additionalFields) {
    const cpfCnpj = additionalFields.cpf_cnpj || '';
    const cleanCpfCnpj = this.omieService.cleanCpfCnpj(cpfCnpj);
    
    // Se CPF (11 dígitos), usa o CPF, senão usa company do shipping_address
    if (cleanCpfCnpj.length === 11) {
      return additionalFields.cpf_cnpj; // Retorna original com formatação
    }
    
    return shopifyData.shipping_address?.company || '';
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
   * Calcula descontos por SKU
   * @param {object} shopifyData 
   * @returns {array}
   */
  getDiscountSKU(shopifyData) {
    const discounts = [];
    
    if (!shopifyData.line_items || !Array.isArray(shopifyData.line_items)) {
      return discounts;
    }

    shopifyData.line_items.forEach(item => {
      const totalDiscount = parseFloat(item.total_discount) || 0;
      if (totalDiscount > 0) {
        discounts.push({
          sku: item.sku || item.variant_id?.toString(),
          discount: totalDiscount,
          quantity: item.quantity || 1,
        });
      }
    });

    return discounts;
  }

  /**
   * Cria registro inicial do pedido na tabela orders
   * @param {object} shopifyData 
   */
  async createInitialOrder(shopifyData) {
    try {
      const { Order } = require('../models');
      
      await Order.upsert({
        shopify_id: shopifyData.name,
        omie_client: null, // Será preenchido depois
        omie_id: null, // Será preenchido depois
        recebido: false,
        pago: false,
        nf: false,
        rastreio: false,
        saiu: false,
        entregue: false,
      });

      queueLogger.debug('Registro inicial do pedido criado', {
        shopifyId: shopifyData.name,
      });
    } catch (error) {
      queueLogger.error('Erro ao criar registro inicial do pedido', {
        shopifyId: shopifyData.name,
        error: error.message,
      });
    }
  }
}

module.exports = SendToOmieJob;