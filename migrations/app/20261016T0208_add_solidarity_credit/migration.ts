#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/72a2c16a51326d32ade7aae78928e6f1e32576a97fccc8c5964892aab58c7b9e/contract';
import endContract from '../../snapshots/72a2c16a51326d32ade7aae78928e6f1e32576a97fccc8c5964892aab58c7b9e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a37ca6aabbac339144867172178dd0ed22e9343706ae299866b8a8e37d08abc8/contract';
import startContract from '../../snapshots/a37ca6aabbac339144867172178dd0ed22e9343706ae299866b8a8e37d08abc8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'CreditRequest',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('enterpriseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'SolidarityEnterprise',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('document', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'SolidarityEnterprise',
        constraint: 'SolidarityEnterprise_document_key',
        columns: ['document'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CreditRequest',
        index: 'CreditRequest_enterpriseId_idx_c87d438a',
        columns: ['enterpriseId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CreditRequest',
        foreignKey: {
          name: 'CreditRequest_enterpriseId_fkey',
          columns: ['enterpriseId'],
          references: { schema: 'public', table: 'SolidarityEnterprise', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
