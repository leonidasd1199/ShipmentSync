import { PartialType } from "@nestjs/swagger";
import { CreateLedgerLineDto } from "./create-ledger-line.dto";

export class UpdateLedgerLineDto extends PartialType(CreateLedgerLineDto) {}