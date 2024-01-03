import { format, subDays } from 'date-fns';
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import nodemailer from 'nodemailer';
import { MongoClient } from "mongodb";
const connectionString = process.env.ATLAS_URI || "";
const client = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
await client.connect();
const nameBD = "SafePark";
const nameColecao = "produtos";

import db from "../db/conn.mjs";

const url = process.env.URL;
const hoje = new Date();

const chaveFF = {
    app_key: process.env.CHAVEFF,
    app_secret: process.env.SEGREDOFF,
}
const chaveGF = {
    app_key: process.env.CHAVEGF,
    app_secret: process.env.SEGREDOGF,
}

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailHost = process.env.EMAIL_HOST;
const emailList = process.env.EMAIL_LIST;

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
        console.log("Erro a consultar produto: ", metodo, error.code);
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
    const saldoEstoqueTotal = saldoEstoqueFF?.listaEstoque[0]?.nSaldo  + saldoEstoqueGF?.listaEstoque[0]?.nSaldo - 100000 || 0;

    let modelo = {
        "codigo": codigo,
        "descricao": respostaFF?.descricao,
        "valor_unitario": respostaFF?.valor_unitario,
        "codigoFF": respostaFF?.codigo_produto,
        "codigoGF": respostaGF?.codigo_produto,
        "data_Atual": dataHoje,
        "saldoEstoqueFF": saldoEstoqueFF?.listaEstoque[0]?.nSaldo,
        "saldoEstoqueGF": saldoEstoqueGF?.listaEstoque[0]?.nSaldo,
        "saldoEstoqueTotal": saldoEstoqueTotal,
    }
    console.log(modelo);
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
        console.log(`Produto ${JSON.stringify(respostaDB)} atualizado!`);
        // return respostaDB._id;
    }

async function estoqueMinimo() {
    try {
        // Busca todos os arquivos onde codigoGF EXISTE
        const codProd = await db.collection("produtos").find({ codigoGF: { $exists: true } }).toArray()

        // console.log('DADOS FF')
        var produto = ''
        // Passa por todos os valores que encontrou no Banco de Dados
        for (let i = 0; i < codProd.length; i++) {
            var data = hoje.toLocaleDateString()
            console.log("Linha:", i+1, "de", codProd.length)
            console.log("Produto: ", codProd[i].codigo)
            var estoque = 0;
            estoque = [
                {
                    nIdProduto: codProd[i].codigoGF,
                    dDia: data,
                }
            ]

            // Entra na função buscaEstoque() com código do produto e as chaves
            const buscaGF = await consultaProdutosAtualizados(chaveGF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)

            estoque = [
                {
                    nIdProduto: codProd[i].codigoFF,
                    dDia: data,
                }
            ]
            // Entra na função buscaEstoque() com código do produto e as chaves
            const buscaFF = await consultaProdutosAtualizados(chaveFF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)

            // console.log(buscaFF.listaEstoque[0], buscaGF.listaEstoque[0]);
            // Faz calculo para saber Saldo do Estoque
            if (buscaFF.listaEstoque[0] !== undefined) {
                const saldo = buscaFF.listaEstoque[0].fisico + buscaGF.listaEstoque[0].fisico
                if (buscaFF.listaEstoque[0].nEstoqueMinimo != 0) {
                    if (saldo < buscaFF.listaEstoque[0].nEstoqueMinimo) {
                        console.log("Estoque abaixo do mínimo!!");
                        const dados = "Código Geral: " + codProd[i].codigo +
                            "\n Descrição: " + codProd[i].descricao +
                            "\n Código FF: " + codProd[i].codigoFF + " = " + buscaFF.listaEstoque[0].fisico + " Quantidades" +
                            "\n Código GF: " + codProd[i].codigoGF + " = " + buscaGF.listaEstoque[0].fisico + " Quantidades" +
                            "\n Estoque Mínimo: " + buscaFF.listaEstoque[0].nEstoqueMinimo +
                            "\n Saldo: " + saldo + "\n ----------------------\n"
                        produto = produto.concat(dados)
                    }
                }
            }
            else {
                console.log("Não tem estoque");
                await excluirBD(codProd[i].codigo)
            }
        }
        console.log(produto)
        await email(produto) // Função mandar e-mail
        console.log('ATUALIZADO!!')

    } catch (e) {
        console.error(e);
    } finally {
        // Finalizar o processo do mongo
        await client.close();
    }
}

async function email(produto) {
    let transporter = nodemailer.createTransport({
        // service: 'dreamhost',
        host: emailHost,
        port: 465,
        // secure: true,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    const mailOptions = {
        from: emailUser,
        to: emailList,
        subject: 'Relatório de Estoque',
        text: produto
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('E-mail enviado: ' + info.response);
        }
    });
}

async function excluirBD(cod) {
    // let cod = 'SINISO012.3'
    const consulta = [
        {
            codigo: cod,
        }
    ]
    const respostaFF = await consultaProdutosAtualizados(chaveFF, 'ConsultarProduto', url + '/geral/produtos/', consulta)

    if (respostaFF === undefined) {
        try {

            // Excluir no banco de dados caso não exista no Omie
            await client.db(nameBD).collection(nameColecao).deleteOne(
                { codigo: cod }
            );
            console.log(`Produto ${cod} excluido!`);

        } catch (e) {
            console.error(e);
        } finally {
            // Close the connection to the MongoDB cluster
            // await client.close();
        }
    }
}

async function teste() {
    console.log('Teste');
    // console.log(process.env.EMAIL_LIST);
    await email('Teste de email');
}

export default {
    verificarEstoque,
    atualizar,
    estoqueMinimo,
    excluirBD,
    email,
    teste
};
