import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectFinanceReviewDto {
  @IsNotEmpty({ message: "A note is required when rejecting finance review." })
  @IsString()
  @MaxLength(5000)
  note!: string;
}
