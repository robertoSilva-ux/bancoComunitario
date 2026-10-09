#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11189376a83eee73ce05a83e1599dce6247df153f38d626560beb086d33d766d/contract';
import startContract from '../../snapshots/11189376a83eee73ce05a83e1599dce6247df153f38d626560beb086d33d766d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a37ca6aabbac339144867172178dd0ed22e9343706ae299866b8a8e37d08abc8/contract';
import endContract from '../../snapshots/a37ca6aabbac339144867172178dd0ed22e9343706ae299866b8a8e37d08abc8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Transaction',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
