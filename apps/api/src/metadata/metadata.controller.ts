import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MetadataService } from "./metadata.service";

@ApiTags("metadata")
@Controller("metadata")
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get("service-types")
  getServiceTypes() {
    return this.metadataService.getServiceTypes();
  }

  @Get("shipping-modes")
  getShippingModes() {
    return this.metadataService.getShippingModes();
  }

  @Get("incoterms/:serviceType")
  getIncoterms(@Param("serviceType") serviceType: string) {
    return this.metadataService.getIncotermsByService(serviceType);
  }
}
