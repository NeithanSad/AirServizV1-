import { MigrationInterface, QueryRunner } from "typeorm";

export class InitCatalog1783637559464 implements MigrationInterface {
    name = 'InitCatalog1783637559464'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "providerId" character varying(36) NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(500), "price" numeric(10,2) NOT NULL, "category" character varying(30) NOT NULL, "imageUrl" character varying(500), "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b619ef0a4fe392dbde07eee1e" ON "services" ("providerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cfdcce31c9c571f9e5a8226dec" ON "services" ("category") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_cfdcce31c9c571f9e5a8226dec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b619ef0a4fe392dbde07eee1e"`);
        await queryRunner.query(`DROP TABLE "services"`);
    }

}
