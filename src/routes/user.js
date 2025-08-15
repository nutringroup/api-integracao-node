const { Router } = require('express');
const middleware = require('../middlewares/middleware');
import userController from '../modules/user/controllers/user_controller';

const routes = Router();

routes.post('/', middleware, userController.createUser);
routes.get('/', middleware, userController.getAllUsers);
routes.get('/:id', middleware, userController.getUserById);
routes.put('/:id', middleware, userController.updateUser);
routes.delete('/:id', middleware, userController.deleteUser);

module.exports = routes;
