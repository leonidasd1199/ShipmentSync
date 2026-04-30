import { DynamicModule } from "@nestjs/common";

/**
 * E2E mock for @nestjs/schedule so we don't need the real package when loading AppModule.
 * CronModule only uses ScheduleModule.forRoot().
 */
export const ScheduleModule = {
  forRoot(): DynamicModule {
    return {
      module: class ScheduleModuleStub {},
      global: true,
    };
  },
};

export const Cron = (): MethodDecorator => (): void => {};
export const CronExpression = { EVERY_MINUTE: "* * * * *" };
