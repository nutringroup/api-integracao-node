const { Sequelize } = require('sequelize');

// Configuração do banco
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: '104.251.212.234',
  port: 5432,
  database: 'nutringroup',
  username: 'gummy',
  password: 'Somosrosa@#2024',
  schema: 'gummy_dev',
  logging: console.log,
});

async function removeDuplicates() {
  try {
    console.log('🔄 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conexão estabelecida com sucesso');

    console.log('🔄 Removendo duplicatas da tabela clients...');
    
    // Remover duplicatas de clients
    const [clientResults] = await sequelize.query(`
      WITH duplicates AS (
          SELECT cpf, MIN(id) as keep_id
          FROM gummy_dev.clients 
          GROUP BY cpf 
          HAVING COUNT(*) > 1
      )
      DELETE FROM gummy_dev.clients 
      WHERE id NOT IN (SELECT keep_id FROM duplicates)
      AND cpf IN (SELECT cpf FROM duplicates)
    `);
    
    console.log(`✅ Removidas ${clientResults.rowCount || 0} duplicatas de clients`);

    console.log('🔄 Removendo duplicatas da tabela orders...');
    
    // Remover duplicatas de orders
    const [orderResults] = await sequelize.query(`
      WITH duplicates AS (
          SELECT shopify_id, MIN(id) as keep_id
          FROM gummy_dev.orders 
          GROUP BY shopify_id 
          HAVING COUNT(*) > 1
      )
      DELETE FROM gummy_dev.orders 
      WHERE id NOT IN (SELECT keep_id FROM duplicates)
      AND shopify_id IN (SELECT shopify_id FROM duplicates)
    `);
    
    console.log(`✅ Removidas ${orderResults.rowCount || 0} duplicatas de orders`);

    console.log('🔄 Criando índices únicos...');
    
    // Criar índice único para clients
    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS clients_cpf_unique 
        ON gummy_dev.clients (cpf)
      `);
      console.log('✅ Índice único criado para clients.cpf');
    } catch (error) {
      console.log('⚠️  Índice para clients já existe ou erro:', error.message);
    }

    // Criar índice único para orders
    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_shopify_id_unique 
        ON gummy_dev.orders (shopify_id)
      `);
      console.log('✅ Índice único criado para orders.shopify_id');
    } catch (error) {
      console.log('⚠️  Índice para orders já existe ou erro:', error.message);
    }

    console.log('🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Conexão fechada');
  }
}

// Executar migração
removeDuplicates(); 