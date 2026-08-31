const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');

// Instanciar controlador
const orderController = new OrderController();

// Rotas para pedidos
router.post('/new', orderController.newOrder.bind(orderController));
router.post('/reintegrate', orderController.reintegrateOrder.bind(orderController));
router.post('/reintegrate-multiple', orderController.reintegrateMultipleOrders.bind(orderController));
router.get('/', orderController.listOrders.bind(orderController));
router.get('/:shopify_id', orderController.getOrderDetails.bind(orderController));

module.exports = router; 