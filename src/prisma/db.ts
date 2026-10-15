import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});

/**
 * Tipos derivados da própria fábrica do client — sem importar nada do interior do
 * Prisma. `DbClient` é o client global; `TxClient` é o contexto entregue ao
 * callback de `db.transaction(...)`, cujo `.orm` opera dentro da transação.
 */
export type DbClient = typeof db;
export type TxClient = Parameters<Parameters<DbClient['transaction']>[0]>[0];

/** O que os repositórios aceitam: o client global ou o contexto transacional. */
export type Client = DbClient | TxClient;
