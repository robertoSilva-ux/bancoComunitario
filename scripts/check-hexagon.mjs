#!/usr/bin/env node
/**
 * Guarda da regra de dependência do núcleo hexagonal (item HEX-08 do backlog).
 *
 * O núcleo (`domain/` e `application/`) não pode conhecer detalhes externos.
 * Este script falha com exit 1 se algum arquivo do núcleo importar framework HTTP,
 * cliente de banco, a infraestrutura do projeto ou os adaptadores.
 *
 * É a diferença entre a regra estar escrita numa documentação e a regra estar
 * verificada: qualquer regressão aparece aqui, não na apresentação.
 *
 * Uso: npm run check:hexagon
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Diretórios que formam o núcleo da aplicação. */
const NUCLEO = ["src/solidarity-credit/domain", "src/solidarity-credit/application"];

/** Permitido no núcleo: biblioteca padrão do Node e o núcleo compartilhado (Money, erros). */
const PROIBIDOS = [
    {
        motivo: "framework HTTP (Express)",
        teste: (modulo) => modulo === "express" || modulo.startsWith("express/"),
    },
    {
        motivo: "cliente/CLI do Prisma",
        teste: (modulo) => modulo.startsWith("@prisma/") || modulo === "@prisma/client",
    },
    {
        motivo: "servidor HTTP do Node",
        teste: (modulo) => modulo === "http" || modulo.startsWith("node:http"),
    },
    {
        motivo: "infraestrutura de persistência do projeto (src/prisma)",
        teste: (modulo) => modulo.includes("/prisma/"),
    },
    {
        motivo: "camada HTTP do projeto (src/http)",
        teste: (modulo) => modulo.includes("/http/") || modulo.startsWith("node:http"),
    },
    {
        motivo: "adaptadores do próprio módulo (o núcleo aponta para dentro, não para a borda)",
        teste: (modulo) => modulo.includes("/adapters/"),
    },
];

/** Captura o especificador de cada import/export ... from "..." do arquivo. */
const ESPECIFICADOR = /(?:from|import)\s+["']([^"']+)["']/g;

async function arquivosTypeScript(diretorio) {
    const entradas = await readdir(diretorio, { withFileTypes: true });
    const arquivos = [];

    for (const entrada of entradas) {
        const caminho = path.join(diretorio, entrada.name);
        if (entrada.isDirectory()) {
            arquivos.push(...(await arquivosTypeScript(caminho)));
        } else if (entrada.name.endsWith(".ts")) {
            arquivos.push(caminho);
        }
    }

    return arquivos;
}

function violacoesDoArquivo(caminho, conteudo) {
    const violacoes = [];
    const linhas = conteudo.split("\n");

    linhas.forEach((linha, indice) => {
        ESPECIFICADOR.lastIndex = 0;
        let encontrado;
        while ((encontrado = ESPECIFICADOR.exec(linha)) !== null) {
            const modulo = encontrado[1];
            for (const { motivo, teste } of PROIBIDOS) {
                if (teste(modulo)) {
                    violacoes.push({ caminho, linha: indice + 1, modulo, motivo });
                }
            }
        }
    });

    return violacoes;
}

async function main() {
    const violacoes = [];
    let verificados = 0;

    for (const diretorio of NUCLEO) {
        let arquivos;
        try {
            arquivos = await arquivosTypeScript(diretorio);
        } catch {
            console.error(`✖ diretório do núcleo não encontrado: ${diretorio}`);
            process.exit(1);
        }

        if (arquivos.length === 0) {
            console.error(`✖ nenhum arquivo TypeScript em ${diretorio} — a checagem não teria efeito`);
            process.exit(1);
        }

        for (const arquivo of arquivos) {
            const conteudo = await readFile(arquivo, "utf8");
            violacoes.push(...violacoesDoArquivo(arquivo, conteudo));
            verificados += 1;
        }
    }

    if (violacoes.length > 0) {
        console.error("✖ o núcleo hexagonal importa detalhes externos:\n");
        for (const { caminho, linha, modulo, motivo } of violacoes) {
            console.error(`  ${caminho}:${linha} importa "${modulo}" — ${motivo}`);
        }
        console.error(`\n${violacoes.length} violação(ões). O núcleo deve depender só dele mesmo.`);
        process.exit(1);
    }

    console.log(`✔ núcleo hexagonal isolado (${verificados} arquivos em ${NUCLEO.length} diretórios)`);
}

await main();
