import { MigrationInterface, QueryRunner } from "typeorm";

export class InitPayment1783637571859 implements MigrationInterface {
    name = 'InitPayment1783637571859'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" character varying(36) NOT NULL, "clientId" character varying(36) NOT NULL, "providerId" character varying(36) NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'usd', "status" character varying(20) NOT NULL DEFAULT 'REQUIRES_PAYMENT', "gateway" character varying(40) NOT NULL, "providerRef" character varying(120), "clientSecret" character varying(200), "failureReason" character varying(300), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_af929a5f2a400fdb6913b4967e" ON "payments" ("orderId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_af929a5f2a400fdb6913b4967e"`);
        await queryRunner.query(`DROP TABLE "payments"`);
    }

}
