import { MigrationInterface, QueryRunner } from "typeorm";

export class InitBooking1783637553702 implements MigrationInterface {
    name = 'InitBooking1783637553702'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL, "clientId" character varying(36) NOT NULL, "providerId" character varying(36) NOT NULL, "items" jsonb NOT NULL, "notes" character varying(500), "status" character varying(25) NOT NULL DEFAULT 'PENDING', "totalAmount" numeric(10,2) NOT NULL, "scheduledDate" TIMESTAMP WITH TIME ZONE, "proposedDate" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "orders"`);
    }

}
