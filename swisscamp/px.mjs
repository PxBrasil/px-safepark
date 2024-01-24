import { format, subDays } from 'date-fns';
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import nodemailer from 'nodemailer';
import db from "../db/conn.mjs";
import { promises as fsPromises } from 'fs';



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
        }
    ]

    const respostaFF = await consultaProdutosAtualizados(chaveFF, 'ListarProdutosResumido', url + '/geral/produtos/', param);
    await esperar(2000)

    if (respostaFF !== undefined) {
        var pags = respostaFF.total_de_paginas;

        try {
            while (contador < pags) {
                contador++;
                param[0].pagina = contador;
                const resposta = await consultaProdutosAtualizados(chaveFF, 'ListarProdutosResumido', url + '/geral/produtos/', param);
                await esperar(2000)

                for (let i = 0; i < resposta.produto_servico_resumido.length; i++) {

                    console.log(`Página ${contador} - ${i + 1} de ${resposta.produto_servico_resumido.length} - ${resposta.produto_servico_resumido[i].codigo}`);
                    await atualizar(resposta.produto_servico_resumido[i].codigo)
                    //await fetch('http://localhost:3000/atualizar?codigo=' + resposta.produto_servico_resumido[i].codigo);

                    // if (i === 21) {
                    //     break
                    // }
                }
                //break
            }
        } catch (error) {
            // Escreve no arquivo .json em caso de erro
            const errorMessage = `Erro ao consultar produtos: verificarEstoque()`;
            console.log(errorMessage, error, new Date().toLocaleString());
            await logResponse(errorMessage, "Cannot read properties of undefined (reading 'produto_servico_resumido')", 'errorLog');
        }
    }
    else {
        console.log("Não encontrou produtos");
    }


}

async function logResponse(title, message, arquivo) {
    // Cria um objeto com informações sobre o erro
    const errorInfo = {
        titulo: title,
        Message: message,
        timestamp: new Date().toLocaleString()
    };
    try {
        // Lê o conteúdo atual do arquivo 'errorLog.json'
        const currentContent = await fsPromises.readFile(arquivo + '.json', 'utf-8');
        const currentData = JSON.parse(currentContent);
        currentData.push(errorInfo);
        const newDataJson = JSON.stringify(currentData, null, 2);

        // Escreve o novo JSON de volta no arquivo 'errorLog.json'
        await fsPromises.writeFile(arquivo + '.json', newDataJson);

    } catch (readError) {
        // Se ocorrer um erro ao ler o arquivo, apenas escreva o novo objeto JSON sem adicionar ao conteúdo existente
        const newDataJson = JSON.stringify([errorInfo], null, 2);
        fsPromises.appendFile(arquivo + '.json', newDataJson);
        return undefined;
    }
}

async function esperar(ms) {
    console.log("Esperar: ", ms)
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
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
        data: data
    };
    await esperar(1000)

    try {
        const response = await axios.request(config);
        const data = response.data;
        if (response.status === 200) { return data; }

    } catch (error) {
        const errorMessage = `Erro ao consultar Produtos: ${metodo}`;
        console.error(errorMessage, error.code, new Date().toLocaleString());
        console.log(param)
        await logResponse(errorMessage, error, 'errorLog');
        return error
    }

}

async function atualizar(codigo) {
    try {
        if (codigo !== undefined) {
            const dataHoje = format(hoje, "dd/MM/yyyy");
            const consulta = [{ codigo: codigo }];

            let saldoEstoqueFF = 0;
            let saldoEstoqueGF = 0;
            let estoqueMinimo = 0;

            const respostaFF = await consultaProdutosAtualizados(chaveFF, 'ConsultarProduto', url + '/geral/produtos/', consulta);

            if (respostaFF.codigo_produto === undefined) {
                console.log("Produto não encontrado no Omie");
            }else{
                const estoqueFF = [{ nIdProduto: respostaFF?.codigo_produto, dDia: dataHoje }];
                saldoEstoqueFF = (await consultaProdutosAtualizados(chaveFF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoqueFF)).listaEstoque[0]?.nSaldo;
                estoqueMinimo = (await consultaProdutosAtualizados(chaveFF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoqueFF)).listaEstoque[0]?.nEstoqueMinimo;
                
            }

            const respostaGF = await consultaProdutosAtualizados(chaveGF, 'ConsultarProduto', url + '/geral/produtos/', consulta);

            if (respostaGF.codigo_produto === undefined) {
                console.log("Produto não encontrado no Omie");
            }else{
                const estoqueGF = [{ nIdProduto: respostaGF?.codigo_produto, dDia: dataHoje }];
                saldoEstoqueGF = (await consultaProdutosAtualizados(chaveGF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoqueGF)).listaEstoque[0]?.nSaldo || 0;
                
            }

            const saldoEstoqueTotal = saldoEstoqueFF + saldoEstoqueGF;

            const modelo = {
                codigo: codigo,
                descricao: respostaFF?.descricao,
                valor_unitario: respostaFF?.valor_unitario,
                codigoFF: respostaFF?.codigo_produto,
                codigoGF: respostaGF?.codigo_produto,
                data_Atual: dataHoje,
                saldoEstoqueFF: saldoEstoqueFF,
                saldoEstoqueGF: saldoEstoqueGF,
                saldoEstoqueTotal: saldoEstoqueTotal,
                EstoqueMinimo: estoqueMinimo
            };

            console.log(modelo);
            await updateOneMongo(modelo);
        } else {
            console.log(codigo, " sem código?");
        }
    } catch (error) {
        console.error("Erro ao executar a função:", error);
    }
}



async function atualizarBk(codigo) {
    if (codigo !== undefined) {
        const dataHoje = format(hoje, "dd/MM/yyyy");
        const consulta = [
            {
                codigo: codigo,
            }
        ]

        let estoque = 0;
        let estoqueMinimo = 0;
        let sdFF = 0
        let sdGF = 0

        const respostaFF = await consultaProdutosAtualizados(chaveFF, 'ConsultarProduto', url + '/geral/produtos/', consulta)
        if (respostaFF.codigo_produto !== undefined) {
            console.log("Não encontrou o produto no Omie");
            estoque = [
                {
                    nIdProduto: respostaFF?.codigo_produto,
                    dDia: dataHoje,
                }
            ]
            const saldoEstoqueFF = await consultaProdutosAtualizados(chaveFF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)

            sdFF = saldoEstoqueFF.listaEstoque[0].nSaldo

            estoqueMinimo = saldoEstoqueFF.listaEstoque[0].nEstoqueMinimo

        }

        const respostaGF = await consultaProdutosAtualizados(chaveGF, 'ConsultarProduto', url + '/geral/produtos/', consulta)

        if (respostaGF.codigo_produto !== undefined) {
            estoque = [
                {
                    nIdProduto: respostaGF?.codigo_produto,
                    dDia: dataHoje,
                }
            ]
            const saldoEstoqueGF = await consultaProdutosAtualizados(chaveGF, "ObterEstoqueProduto", url + '/estoque/resumo/', estoque)
            sdGF =  saldoEstoqueGF?.listaEstoque[0]?.nSaldo - 100000 || 0
        }


        const saldoEstoqueTotal = sdFF + sdGF;

        let modelo = {
            "codigo": codigo,
            "descricao": respostaFF?.descricao,
            "valor_unitario": respostaFF?.valor_unitario,
            "codigoFF": respostaFF?.codigo_produto,
            "codigoGF": respostaGF?.codigo_produto,
            "data_Atual": dataHoje,
            "saldoEstoqueFF": sdFF,
            "saldoEstoqueGF": sdGF,
            "saldoEstoqueTotal": saldoEstoqueTotal,
            "EstoqueMinimo": estoqueMinimo
        }
        console.log(modelo);
        await updateOneMongo(modelo);
    } else {
        console.log(codigo, " sem código?")
    }

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
    console.log(`Produto ${respostaDB?.codigo} atualizado!`);
    const successMessage = `Atualização bem sucedida:`;
    await logResponse(successMessage, obj.codigo, 'successLog');


}

async function novoEmail(estoqueMinimo, saldo) {
    let produto = ''
    if (estoqueMinimo != 0) {
        if (saldo < estoqueMinimo) {
            console.log("Estoque abaixo do mínimo!!");
            const dados = "Código Geral: " + codProd[i].codigo +
                "\n Descrição: " + codProd[i].descricao +
                "\n Código FF: " + codProd[i].codigoFF + " = " + saldoFF + " Quantidades" +
                "\n Código GF: " + codProd[i].codigoGF + " = " + saldoGF + " Quantidades" +
                "\n Estoque Mínimo: " + buscaFF.listaEstoque[0].nEstoqueMinimo +
                "\n Saldo: " + saldo + "\n ----------------------\n"
            produto = produto.concat(dados)
        }
    }
    await email(produto) // Função mandar e-mail
    console.log('ATUALIZADO!!')
    return produto
}

async function estoqueMinimo() {

    try {
        // Busca todos os arquivos onde codigoGF EXISTE
        const codProd = await db.collection("produtos").find({ codigoFF: { $exists: true } }).toArray()
        console.log(codProd)
        var produto = ''
        // Passa por todos os valores que encontrou no Banco de Dados
        for (let i = 0; i < codProd.length; i++) {
            // Pausa de 3 segundos para não dar erro no Omie

            var data = hoje.toLocaleDateString()
            console.log("Linha:", i + 1, "de", codProd.length)
            //console.log("Produto: ", codProd[i].codigo)
            //console.log("Estoque Mínimo: ", codProd[i].EstoqueMinimo)
            if (codProd[i].EstoqueMinimo !== undefined && codProd[i].EstoqueMinimo !== 0) {
                if (codProd[i].saldoEstoqueTotal !== undefined) {
                    console.log("ESTOQUES", codProd[i].saldoEstoqueTotal);

                    if (codProd[i].saldoEstoqueTotal < codProd[i].EstoqueMinimo) {
                        console.log("Estoque abaixo do mínimo!!");
                        const dados = "Código Geral: " + codProd[i].codigo +
                            "\n Descrição: " + codProd[i].descricao +
                            "\n Estoque Mínimo: " + codProd[i].EstoqueMinimo +
                            "\n Saldo: " + codProd[i].saldoEstoqueTotal + "\n ----------------------\n"
                        produto = produto.concat(dados)
                    }

                }
                else {
                    console.log("Não encontrou estoque no produto", codProd[i].codigo);
                }

            }
            else {
                console.log(`${codProd[i].codigo} não tem estoque mínimo definido ou é igual à ZERO -> ${codProd[i].EstoqueMinimo}`);
                // await excluirBD(codProd[i].codigo)
            }
        }
        if (produto === '') {
            produto = `Não tem ESTOQUE abaixo do mínimo configurado pela ferramenta Omie`
        }
        console.log(produto)
        //await email(produto) // Função mandar e-mail
        await wpp(produto)
        console.log('ATUALIZADO!!')

    } catch (e) {
        console.error(e);
        // Escreve no arquivo .json em caso de erro
        const errorMessage = `Ocorreu um erro durante a execução - EstoqueMinimo()`;
        await logResponse(errorMessage, e.code, 'errorLog');
    } finally {
        // Finalizar o processo do mongo
    }
}

async function email(produto) {
    try {
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
    } catch (error) {
        console.log("Erro ao enviar e-mail: ", error.code, new Date().toLocaleString());
        // Escreve no arquivo .json em caso de erro
        const errorMessage = `Erro ao enviar e-mail: email()`;
        await logResponse(errorMessage, error.code, 'errorLog');
    }
}

async function wpp(params) {
    const dados = JSON.stringify({
        "mensagem":params
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://notifica.plenitudex.com/omie/estoquebaixo`,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        data: dados
    };

    const resposta = await axios.request(config)
        .then((response) => {
            console.log('Sucesso: ',response.status);
            return response.status
        })
        .catch((error) => {
            console.log('Erro: ',error);
            return 'Erro na requisição: '+error.config.data
        });

    return resposta
  };

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
            await db.collection('produtos').deleteOne(
                { codigo: cod }
            );
            console.log(`Produto ${cod} excluido!`);

        } catch (e) {
            console.error(e);
        }
    }
}

export default {
    verificarEstoque,
    atualizar,
    estoqueMinimo,
    excluirBD,
    esperar,
    email
};
