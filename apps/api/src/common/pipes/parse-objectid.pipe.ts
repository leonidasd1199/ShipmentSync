import { BadRequestException, PipeTransform } from "@nestjs/common";
import { Types } from "mongoose";

/**
 * Pipe to validate and transform string to ObjectId
 * @usage @Param('id', ParseObjectIdPipe) id: Types.ObjectId
 */
export class ParseObjectIdPipe
  implements PipeTransform<string, Types.ObjectId>
{
  transform(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ObjectId: ${value}`);
    }
    return new Types.ObjectId(value);
  }
}
