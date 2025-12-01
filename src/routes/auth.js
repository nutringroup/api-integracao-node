const { Router } = require('express');
const authController = require('../modules/auth/controllers/auth_controller');


const routes = Router();

routes.post('/sign-in', authController.signIn);

module.exports = routes;
