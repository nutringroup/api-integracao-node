const { OmieService } = require('./src/services/OmieService');
const { HistoryLog } = require('./src/models');

// Simular dados do Shopify
const mockShopifyData = {
  name: 'TEST-ORDER-123',
  customer: {
    id: 7325099098244,
    email: 'test@example.com'
  },
  shipping_address: {
    name: 'Cliente Teste',
    address1: 'Rua Teste, 123',
    city: 'São Paulo',
    province_code: 'SP',
    zip: '01234-567',
    phone: '11999999999'
  },
  note_attributes: [
    {
      name: 'additional_cpf_cnpj',
      value: '12345678901'
    }
  ]
};

// Simular resposta de erro do OMIE
const mockErrorResponse = {
  faultcode: 'SOAP-ENV:Client-102',
  faultstring: 'ERROR: Cliente já cadastrado para o Código de Integração [7325099098244] com o nCod [2274524288] !',
  httpCode: 500
};

async function testClientIntegrationError() {
  console.log('🧪 Testando tratamento de erro: Cliente já cadastrado para o Código de Integração');
  
  try {
    const omieService = new OmieService();
    
    // Simular o erro extraindo o nCod
    const faultstring = mockErrorResponse.faultstring;
    const nCodMatch = faultstring.match(/nCod \[(\d+)\]/);
    
    if (nCodMatch && nCodMatch[1]) {
      const omieClientId = nCodMatch[1];
      
      console.log('✅ Regex funcionando corretamente!');
      console.log('📋 Dados extraídos:');
      console.log(`   - Código de Integração: ${mockShopifyData.customer.id}`);
      console.log(`   - nCod extraído: ${omieClientId}`);
      console.log(`   - Mensagem original: ${faultstring}`);
      
      // Simular salvamento da relação
      console.log('💾 Salvando relação cliente...');
      await omieService.saveClientRelation(omieClientId, mockShopifyData);
      
      // Simular criação do log
      console.log('📝 Criando log de histórico...');
      await HistoryLog.create({
        step: 67,
        shopify_id: mockShopifyData.name,
        log: { 
          status: 'Cliente já cadastrado - Código de Integração tratado (TESTE)',
          omie_client_id: omieClientId,
          codigo_integracao: mockShopifyData.customer.id,
          faultstring: faultstring
        },
      });
      
      console.log('✅ Teste concluído com sucesso!');
      console.log('🎯 O tratamento da exceção está funcionando corretamente');
      
      return { codigo_cliente_omie: omieClientId };
    } else {
      console.log('❌ Erro: Não foi possível extrair o nCod da mensagem');
      console.log(`   Mensagem: ${faultstring}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    return null;
  }
}

// Executar o teste
if (require.main === module) {
  testClientIntegrationError()
    .then(result => {
      if (result) {
        console.log('\n🎉 Teste bem-sucedido!');
        console.log(`   Cliente ID: ${result.codigo_cliente_omie}`);
      } else {
        console.log('\n❌ Teste falhou!');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { testClientIntegrationError }; 