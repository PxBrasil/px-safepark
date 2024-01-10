import express from 'express';
const router = express.Router();
import px from '../swisscamp/px.mjs'
import cron from 'node-cron';

router.get('/', (req, res) => {
    res.send('Bem vindo ao servidor Safepark!');
});

router.get('/start', function(req, res, next) { // /start?dias=3 ou /start
    px.verificarEstoque(req.query.dias || "3");
    // Fazer de hora em hora
    cron.schedule('0 * * * *', () => {
        px.verificarEstoque(req.query.dias || "3");
    });
    res.send('Essa rota irá começar a atualizar os produtos!');
});

router.get('/atualizar', function(req, res, next) { // /atualizar?codigo=SINISO012.3
    px.atualizar(req.query.codigo)
    res.send('Essa rota irá atualizar o produto ' + req.query.codigo);
});

router.get('/estoqueMinimo', function(req, res, next) { // /estoqueMinimo
    px.estoqueMinimo()
    // Fazer todo dia as 18h10
    cron.schedule('0 18 10 * *', () => {
        px.estoqueMinimo();
    });
    res.send('Essa rota irá atualizar o estoque mínimo!');
});

router.get('/excluir', function(req, res, next) { // /excluir?codigo=SINISO012.3
    px.excluirBD(req.query.codigo)
    res.send('Essa rota irá excluir o produto ' + req.query.codigo);
});

export default router;
