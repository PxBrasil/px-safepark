import express from 'express';
const router = express.Router();
import px from '../swisscamp/px.mjs'
import cron from 'node-cron';

router.get('/', (req, res) => {
    res.send('Bem vindo ao servidor Safepark!');
});

router.get('/start', function(req, res, next) { // /start?dias=3 ou /start
    console.log("Atualização de Estoque -",new Date().toLocaleString());
    px.verificarEstoque(req.query.dias || "3");
    // Fazer a cada 30 minutos
    cron.schedule('0 * * * *', () => {
        console.log("Atualização de Estoque -",new Date().toLocaleString());
        px.verificarEstoque(req.query.dias || "3");
    });
    res.send('Essa rota irá começar a atualizar os produtos!');
});

router.get('/atualizar', async function (req, res, next) { // /atualizar?codigo=SINISO012.3
    await px.atualizar(req.query.codigo)
    res.send('Essa rota irá atualizar o produto ' + req.query.codigo);
});

router.get('/estoqueMinimo', function(req, res, next) { // /estoqueMinimo
    console.log("Estoque mínimo",new Date().toLocaleString());
    px.estoqueMinimo()
    // Fazer todo dia as 18h10
    cron.schedule('10 18 * * *', () => {
        console.log("Estoque mínimo -",new Date().toLocaleString());
        px.estoqueMinimo();
    });
    res.send('Essa rota irá atualizar o estoque mínimo!');
});

router.get('/excluir', function(req, res, next) { // /excluir?codigo=SINISO012.3
    px.excluirBD(req.query.codigo)
    res.send('Essa rota irá excluir o produto ' + req.query.codigo);
});

export default router;
