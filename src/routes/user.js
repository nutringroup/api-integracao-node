const { Router } = require('express');
const userController = require('../modules/user/controllers/user_controller').default;

const routes = Router();
routes.post('/', (req, res) => userController.createUser(req, res));
routes.get('/',  userController.getAllUsers);
routes.get('/:id',  userController.getUserById);
routes.put('/:id',  userController.updateUser);
routes.delete('/:id',  userController.deleteUser);

module.exports = routes;
