import { format, subDays } from 'date-fns';
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import db from "../db/conn.mjs";

const url = 'https://app.omie.com.br/api/v1/';
const hoje = new Date();

const chaveFF = {
    app_key: process.env.CHAVEFF,
    app_secret: process.env.SEGREDOFF,
}
const chaveGF = {
    app_key: process.env.CHAVEGF,
    app_secret: process.env.SEGREDOGF,
}

async function verificarEstoque(dias) {
    const diasAtras = subDays(hoje, dias);
    const DataFormat = format(diasAtras, "dd/MM/yyyy");
    console.log(DataFormat);
    let contador = 0;

    const param = [
        {
            "pagina": 1,
            "apenas_importado_api": "N",
            "filtrar_apenas_omiepdv": "N",
            "inativo": "N",
            "ordenar_por": "CODIGO_PRODUTO",
            "ordem_decrescente": "S",
            "filtrar_apenas_alteracao": "S",
            "filtrar_por_data_de": DataFormat,
        }
    ]

    const respostaFF = await consultaProdutosAtualizados(chaveFF, 'ListarProdutosResumido', url+'/geral/produtos/', param)

    if (respostaFF !== undefined) {
        var pags = respostaFF.total_de_paginas;

        while (contador < pags) {
            contador++;
            param[0].pagina = contador;
            const resposta = await consultaProdutosAtualizados(chaveFF, 'ListarProdutosResumido', url + '/geral/produtos/', param)
            for (let i = 0; i < resposta.produto_servico_resumido.length; i++) {
                setTimeout (() => {
                    const element = resposta.produto_servico_resumido[i];
                    console.log(`${i+1} de ${resposta.produto_servico_resumido.length} - ${element.codigo}`);
                    fetch('http://localhost:3000/atualizar?codigo=' + element.codigo)
                }, i * 5000);
            }
        }
    }
}

async function consultaProdutosAtualizados(empresa, metodo, url, param) {
    let data = JSON.stringify({
    "call": metodo,
    "app_key": empresa.app_key,
    "app_secret": empresa.app_secret,
    "param": param
    });

    let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: url,
    headers: {
        'Content-Type': 'application/json'
    },
    data : data
    };

    const response = await axios.request(config)
    .then((response) => {
    return response.data;
    })
    .catch((error) => {
        console.log(error.code);
    });
    return response;
}

async function atualizar(codigo) {
    const dataHoje = format(hoje, "dd/MM/yyyy");
    const consulta = [
        {
            codigo: codigo,
        }
    ]

    let estoque = 0;

    const respostaFF = await consultaProdutosAtualizados(chaveFF, 'ConsultarProduto', url + '/geral/produtos/', consulta)

    estoque = [
        {
            nIdProduto: respostaFF?.codigo_produto,
            dDia: dataHoje,
        }
    ]
    const saldoEstoqueFF = await consultaProdutosAtualizados(chaveFF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)
    const respostaGF = await consultaProdutosAtualizados(chaveGF, 'ConsultarProduto', url + '/geral/produtos/', consulta)
    estoque = [
        {
            nIdProduto: respostaGF?.codigo_produto,
            dDia: dataHoje,
        }
    ]
    const saldoEstoqueGF = await consultaProdutosAtualizados(chaveGF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)
    const saldoEstoqueTotal = saldoEstoqueFF.listaEstoque[0].nSaldo + saldoEstoqueGF.listaEstoque[0].nSaldo - 100000

    let modelo = {
        "codigo": codigo,
        "descicao": respostaFF.descricao,
        "valor_unitario": respostaFF.valor_unitario,
        "codigoFF": respostaFF.codigo_produto,
        "codigoGF": respostaGF.codigo_produto,
        "data_Atual": dataHoje,
        "saldoEstoqueFF": saldoEstoqueFF.listaEstoque[0].nSaldo,
        "saldoEstoqueGF": saldoEstoqueGF.listaEstoque[0].nSaldo,
        "saldoEstoqueTotal": saldoEstoqueTotal,
    }
    // console.log(modelo);
    await updateOneMongo(modelo);
}

async function updateOneMongo(obj) {
    const dataHoje = format(hoje, "dd/MM/yyyy");
    obj.data_Atual = dataHoje;
    const respostaDB = await db.collection("produtos").findOneAndUpdate(
        { codigo: obj.codigo },
        {
            $set: obj,
        },
        { upsert: true } // Atualiza se existir, insere se não existir
    );
    console.log(`Produto ${respostaDB.codigo} atualizado!`);
    // return respostaDB.lastErrorObject.updatedExisting;
}

export default {
    verificarEstoque,
    atualizar,
};
