#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/11189376a83eee73ce05a83e1599dce6247df153f38d626560beb086d33d766d/contract';
import endContract from '../../snapshots/11189376a83eee73ce05a83e1599dce6247df153f38d626560beb086d33d766d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Account',
        columns: [
          col('balance', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('document', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('holderName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Account',
        constraint: 'Account_document_key',
        columns: ['document'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
