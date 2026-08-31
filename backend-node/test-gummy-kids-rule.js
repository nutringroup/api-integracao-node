const SendToOmieJob = require('./src/jobs/SendToOmieJob');

// Mock dos serviços necessários
const mockOmieService = {
  getProductBySku: async (sku) => {
    console.log(`🔍 Buscando produto com SKU: ${sku}`);
    return { codigo_produto: sku };
  }
};

const mockShopifyService = {
  getShippingInfo: () => ({ code: 'FRENET_PAC_03298', price: 15.00 })
};

// Dados de teste simulando um pedido com "6 Gummy kids Frutas"
const testShopifyData = {
  name: '746096',
  customer: {
    id: 123456,
    email: 'test@example.com'
  },
  shipping_address: {
    name: 'João Silva',
    address1: 'Rua Teste, 123',
    city: 'São Paulo',
    province_code: 'SP',
    zip: '01234-567'
  },
  line_items: [
    {
      id: 1,
      name: '6 Gummy kids Frutas',
      sku: 'CBGH999', // SKU original que deve ser substituído
      quantity: 2,
      price: '25.90',
      discount_allocations: []
    },
    {
      id: 2,
      name: 'Outro Produto',
      sku: 'CBGH448', // Este deve usar o mapeamento normal
      quantity: 1,
      price: '30.00',
      discount_allocations: []
    }
  ],
  note_attributes: []
};

async function testGummyKidsRule() {
  console.log('🧪 Testando regra especial para "6 Gummy kids Frutas"');
  console.log('=' .repeat(60));

  try {
    // Criar instância do job
    const job = new SendToOmieJob();
    job.omieService = mockOmieService;
    job.shopifyService = mockShopifyService;

    // Processar line items
    console.log('📦 Processando line items...');
    const lineItems = await job.processLineItems(testShopifyData);

    console.log('\n📊 Resultados:');
    lineItems.forEach((item, index) => {
      const originalItem = testShopifyData.line_items[index];
      console.log(`\n${index + 1}. ${originalItem.name}`);
      console.log(`   SKU Original: ${originalItem.sku}`);
      console.log(`   SKU Final: ${item.produto.codigo_produto}`);
      console.log(`   Quantidade: ${item.produto.quantidade}`);
      
      // Verificar se a regra foi aplicada corretamente
      if (originalItem.name.includes('6 Gummy kids Frutas')) {
        if (item.produto.codigo_produto === 'KGK006') {
          console.log('   ✅ Regra especial aplicada corretamente!');
        } else {
          console.log('   ❌ Regra especial NÃO foi aplicada!');
        }
      } else if (originalItem.sku === 'CBGH448') {
        if (item.produto.codigo_produto === 'CBGH614') {
          console.log('   ✅ Mapeamento normal aplicado corretamente!');
        } else {
          console.log('   ❌ Mapeamento normal NÃO foi aplicado!');
        }
      }
    });

    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testGummyKidsRule(); 