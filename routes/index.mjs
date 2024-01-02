import express from 'express';
const router = express.Router();
import px from '../swisscamp/px.mjs'

router.get('/', (req, res) => {
    res.send('Bem vindo ao servidor Safepark!');
});

router.get('/start', function(req, res, next) {
    px.verificarEstoque(req.query.dias);
    next();
    res.send('Essa rota irá começar a atualizar os produtos!');
});

router.get('/atualizar', function(req, res, next) {
    px.atualizar(req.query.codigo)
    next();
    res.send('Essa rota irá atualizar o produto ' + req.query.codigo);
});

export default router;
