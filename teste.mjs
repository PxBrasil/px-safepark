import px from './swisscamp/px.mjs'
// px.excluirBD('120500200');
// px.estoqueMinimo()
// px.atualizar('SINBAL09.2')
// px.email('Mensagem de teste para esse email')
// px.teste()
//px.verificarEstoque('3')


var estoque = 0;
estoque = [
    {
        nIdProduto: 2543355191,
        dDia: data,
    }
]

// Entra na função buscaEstoque() com código do produto e as chaves
const buscaGF = await consultaProdutosAtualizados(chaveGF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)
