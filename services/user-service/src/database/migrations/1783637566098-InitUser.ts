import { MigrationInterface, QueryRunner } from "typeorm";

export class InitUser1783637566098 implements MigrationInterface {
    name = 'InitUser1783637566098'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "profiles" ("userId" uuid NOT NULL, "fullName" character varying(120) NOT NULL, "role" character varying NOT NULL DEFAULT 'CLIENT', "bio" character varying(300), "photoUrl" character varying(500), "phone" character varying(30), "city" character varying(80), "address" character varying(200), "latitude" numeric(9,6), "longitude" numeric(9,6), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_315ecd98bd1a42dcf2ec4e2e985" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aef4f7b3803debc0197f4490b9" ON "profiles" ("role") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_aef4f7b3803debc0197f4490b9"`);
        await queryRunner.query(`DROP TABLE "profiles"`);
    }

}
