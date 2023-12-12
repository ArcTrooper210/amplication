import { Test, TestingModule } from "@nestjs/testing";
import { MockedAmplicationLoggerProvider } from "@amplication/util/nestjs/logging/test-utils";
import { BillingService } from "./billing.service";
import { SegmentAnalyticsService } from "../../services/segmentAnalytics/segmentAnalytics.service";
import { ConfigService } from "@nestjs/config";
import { Env } from "../../env";
import { BillingPlan, BillingFeature } from "@amplication/util-billing-types";
import Stigg, {
  BooleanEntitlement,
  FullSubscription,
  MeteredEntitlement,
  SubscriptionStatus,
} from "@stigg/node-server-sdk";
import { GitOrganization, GitRepository, Project, User } from "../../models";
import { EnumSubscriptionPlan, EnumSubscriptionStatus } from "../../prisma";
import { BillingLimitationError } from "../../errors/BillingLimitationError";
import { EnumGitProvider } from "../git/dto/enums/EnumGitProvider";

jest.mock("@stigg/node-server-sdk");
Stigg.initialize = jest.fn().mockReturnValue(Stigg.prototype);
Stigg.prototype.waitForInitialization = jest
  .fn()
  .mockResolvedValue(Stigg.prototype);

describe("BillingService", () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        {
          provide: SegmentAnalyticsService,
          useValue: {
            track: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (variable) => {
              switch (variable) {
                case Env.BILLING_ENABLED:
                  return "true";
                default:
                  return "";
              }
            },
          },
        },
        MockedAmplicationLoggerProvider,
        BillingService,
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getSubscription, as amplication always have only one subscription", () => {
    it.each([
      [
        BillingPlan.Free,
        SubscriptionStatus.Active,
        EnumSubscriptionStatus.Active,
        EnumSubscriptionPlan.Free,
      ],
      [
        BillingPlan.Enterprise,
        SubscriptionStatus.Active,
        EnumSubscriptionStatus.Active,
        EnumSubscriptionPlan.Enterprise,
      ],
      [
        BillingPlan.Enterprise,
        SubscriptionStatus.InTrial,
        EnumSubscriptionStatus.Trailing,
        EnumSubscriptionPlan.Enterprise,
      ],
    ])(
      "should return %s subscription when subscription status is %s",
      async (
        planId,
        subscriptionStatus,
        expectSubscriptionStatus,
        expectSubscriptionPlanId
      ) => {
        // Arrange
        const spyOnStiggGetActiveSubscriptions = jest.spyOn(
          Stigg.prototype,
          "getActiveSubscriptions"
        );

        spyOnStiggGetActiveSubscriptions.mockResolvedValue([
          <FullSubscription>{
            id: "id",
            status: subscriptionStatus,
            plan: {
              id: planId,
            },
          },
        ]);

        const workspaceId = "workspace-id";
        // Act
        const result = await service.getSubscription(workspaceId);

        // Assert
        expect(result).toEqual({
          id: "id",
          status: expectSubscriptionStatus,
          workspaceId,
          subscriptionPlan: expectSubscriptionPlanId,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      }
    );

    it.each([
      SubscriptionStatus.Canceled,
      SubscriptionStatus.Expired,
      SubscriptionStatus.NotStarted,
      SubscriptionStatus.PaymentPending,
    ])(
      "should return null as subscription when subscription status is %s",
      async (subscriptionStatus) => {
        // Arrange
        const spyOnStiggGetActiveSubscriptions = jest.spyOn(
          Stigg.prototype,
          "getActiveSubscriptions"
        );

        spyOnStiggGetActiveSubscriptions.mockResolvedValue([]);

        const workspaceId = "workspace-id";
        // Act
        const result = await service.getSubscription(workspaceId);

        // Assert
        expect(result).toBeNull();
      }
    );
  });

  it("should provision customer and not sync free plans to Stripe", async () => {
    const spyOnStiggProvisionCustomer = jest.spyOn(
      Stigg.prototype,
      "provisionCustomer"
    );

    await service.provisionCustomer("id", BillingPlan.Free);

    expect(spyOnStiggProvisionCustomer).toHaveBeenCalledTimes(1);
    expect(spyOnStiggProvisionCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldSyncFree: false,
      })
    );
  });

  it("should throw exceptions on number of services if the workspace has no entitlement to bypass code generation limitation", async () => {
    const workspaceId = "id";
    const projectId = "project-id-1";
    const servicesPerWorkspaceLimit = 3;

    const spyOnServiceGetBooleanEntitlement = jest
      .spyOn(service, "getBooleanEntitlement")
      .mockResolvedValue({
        hasAccess: false,
      } as BooleanEntitlement);

    const spyOnServiceGetMeteredEntitlement = jest
      .spyOn(service, "getMeteredEntitlement")
      .mockResolvedValue({
        hasAccess: false,
        usageLimit: servicesPerWorkspaceLimit,
      } as MeteredEntitlement);

    const user: User = {
      id: "user-id",
      account: {
        id: "account-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "email",
        firstName: "first-name",
        lastName: "last-name",
        password: "password",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isOwner: true,
    };

    const projects: Project[] = [
      {
        id: projectId,
        name: "project-1",
        workspaceId: workspaceId,
        useDemoRepo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const repositories: GitRepository[] = [
      {
        gitOrganizationId: "git-organization-id",
        name: "git-repository-name",
        createdAt: new Date(),
        updatedAt: new Date(),
        id: "git-repository-id",
        gitOrganization: {
          provider: EnumGitProvider.Github,
          id: "git-organization-id",
        } as unknown as GitOrganization,
      },
    ];

    await expect(
      service.validateSubscriptionPlanLimitationsForWorkspace({
        workspaceId,
        currentUser: user,
        currentProjectId: projectId,
        projects,
        repositories,
      })
    ).rejects.toThrow(
      new BillingLimitationError(
        "Your workspace exceeds its resource limitation."
      )
    );

    expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledTimes(1);
    expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledWith(
      workspaceId,
      BillingFeature.IgnoreValidationCodeGeneration
    );
    await expect(
      service.getBooleanEntitlement(
        workspaceId,
        BillingFeature.IgnoreValidationCodeGeneration
      )
    ).resolves.toEqual(
      expect.objectContaining({
        hasAccess: false,
      })
    );

    expect(spyOnServiceGetMeteredEntitlement).toHaveBeenNthCalledWith(
      1,
      workspaceId,
      BillingFeature.Services
    );
    await expect(
      service.getMeteredEntitlement(workspaceId, BillingFeature.Services)
    ).resolves.toEqual(
      expect.objectContaining({
        hasAccess: false,
      })
    );
  });

  it("should throw exceptions on number of team members if the workspace has no entitlement to bypass code generation limitation", async () => {
    const workspaceId = "id";
    const projectId = "project-id-1";
    const projectsPerWorkspaceLimit = 1;
    const entitiesPerServiceLimit = 5;
    const servicesPerWorkspaceLimit = 3;
    const teamMembersPerWorkspaceLimit = 2;

    const spyOnServiceGetBooleanEntitlement = jest
      .spyOn(service, "getBooleanEntitlement")
      .mockResolvedValue({
        hasAccess: false,
      } as BooleanEntitlement);

    const spyOnServiceGetMeteredEntitlement = jest
      .spyOn(service, "getMeteredEntitlement")
      .mockImplementation(async (workspaceId, feature) => {
        switch (feature) {
          case BillingFeature.Projects:
            return {
              hasAccess: true,
              usageLimit: projectsPerWorkspaceLimit,
            } as MeteredEntitlement;
          case BillingFeature.Services:
            return {
              hasAccess: true,
              usageLimit: servicesPerWorkspaceLimit,
            } as MeteredEntitlement;
          case BillingFeature.ServicesAboveEntitiesPerServiceLimit:
            return {
              hasAccess: false,
              usageLimit: entitiesPerServiceLimit,
            } as MeteredEntitlement;
          case BillingFeature.TeamMembers:
            return {
              hasAccess: false,
              usageLimit: teamMembersPerWorkspaceLimit,
            } as MeteredEntitlement;
        }
      });

    const user: User = {
      id: "user-id",
      account: {
        id: "account-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "email",
        firstName: "first-name",
        lastName: "last-name",
        password: "password",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isOwner: true,
    };

    const projects: Project[] = [
      {
        id: projectId,
        name: "project-1",
        workspaceId: workspaceId,
        useDemoRepo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const repositories: GitRepository[] = [
      {
        gitOrganizationId: "git-organization-id",
        name: "git-repository-name",
        createdAt: new Date(),
        updatedAt: new Date(),
        id: "git-repository-id",
        gitOrganization: {
          provider: EnumGitProvider.Github,
          id: "git-organization-id",
        } as unknown as GitOrganization,
      },
    ];

    await expect(
      service.validateSubscriptionPlanLimitationsForWorkspace({
        workspaceId,
        currentUser: user,
        currentProjectId: projectId,
        projects,
        repositories,
      })
    ).rejects.toThrow(
      new BillingLimitationError(
        "Your workspace exceeds its team member limitation."
      )
    );

    expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledTimes(1);
    expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledWith(
      workspaceId,
      BillingFeature.IgnoreValidationCodeGeneration
    );
    await expect(
      service.getBooleanEntitlement(
        workspaceId,
        BillingFeature.IgnoreValidationCodeGeneration
      )
    ).resolves.toEqual(
      expect.objectContaining({
        hasAccess: false,
      })
    );

    expect(spyOnServiceGetMeteredEntitlement).toHaveBeenCalledTimes(2);

    expect(spyOnServiceGetMeteredEntitlement).toHaveBeenNthCalledWith(
      1,
      workspaceId,
      BillingFeature.Services
    );
    expect(spyOnServiceGetMeteredEntitlement).toHaveBeenNthCalledWith(
      2,
      workspaceId,
      BillingFeature.TeamMembers
    );
  });

  it.each([
    EnumGitProvider.AwsCodeCommit,
    EnumGitProvider.Bitbucket,
    EnumGitProvider.GitLab,
  ])(
    "should throw exception when using %s git provider if the workspace has no entitlement or bypass code generation limitation",
    async (currentGitProvider) => {
      const workspaceId = "id";
      const projectId = "project-id-1";

      const spyOnServiceGetBooleanEntitlement = jest
        .spyOn(service, "getBooleanEntitlement")
        .mockImplementation(async (workspaceId, feature) => {
          switch (feature) {
            case BillingFeature[
              currentGitProvider as keyof typeof BillingFeature
            ]:
            case BillingFeature.IgnoreValidationCodeGeneration:
              return {
                hasAccess: false,
              } as BooleanEntitlement;

            default:
              return {
                hasAccess: true,
              } as BooleanEntitlement;
          }
        });

      jest.spyOn(service, "getMeteredEntitlement").mockResolvedValue({
        hasAccess: true,
        usageLimit: 1000,
      } as MeteredEntitlement);

      const user: User = {
        id: "user-id",
        account: {
          id: "account-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "email",
          firstName: "first-name",
          lastName: "last-name",
          password: "password",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isOwner: true,
      };

      const projects: Project[] = [
        {
          id: projectId,
          name: "project-1",
          workspaceId: workspaceId,
          useDemoRepo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const repositories: GitRepository[] = [
        {
          gitOrganizationId: "git-organization-id",
          name: "git-repository-name",
          createdAt: new Date(),
          updatedAt: new Date(),
          id: "git-repository-id",
          gitOrganization: {
            provider: EnumGitProvider[currentGitProvider],
            id: "git-organization-id",
          } as unknown as GitOrganization,
        },
      ];

      await expect(
        service.validateSubscriptionPlanLimitationsForWorkspace({
          workspaceId,
          currentUser: user,
          currentProjectId: projectId,
          projects,
          repositories,
        })
      ).rejects.toThrow(
        new BillingLimitationError(
          `Your workspace uses ${currentGitProvider} integration, while it is not part of your current plan.`
        )
      );

      expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledWith(
        workspaceId,
        BillingFeature.IgnoreValidationCodeGeneration
      );

      expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledWith(
        workspaceId,
        BillingFeature[currentGitProvider as keyof typeof BillingFeature]
      );
    }
  );

  it.each([EnumGitProvider.Github])(
    "should not throw exception when using %s git provider as it is the default provider and never checked for entitlements",
    async (currentGitProvider) => {
      const workspaceId = "id";
      const projectId = "project-id-1";

      const spyOnServiceGetBooleanEntitlement = jest
        .spyOn(service, "getBooleanEntitlement")
        .mockImplementation(async (workspaceId, feature) => {
          switch (feature) {
            case BillingFeature[
              currentGitProvider as keyof typeof BillingFeature
            ]:
            case BillingFeature.IgnoreValidationCodeGeneration:
              return {
                hasAccess: false,
              } as BooleanEntitlement;

            default:
              return {
                hasAccess: true,
              } as BooleanEntitlement;
          }
        });

      jest.spyOn(service, "getMeteredEntitlement").mockResolvedValue({
        hasAccess: true,
        usageLimit: 1000,
      } as MeteredEntitlement);

      const user: User = {
        id: "user-id",
        account: {
          id: "account-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "email",
          firstName: "first-name",
          lastName: "last-name",
          password: "password",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isOwner: true,
      };

      const projects: Project[] = [
        {
          id: projectId,
          name: "project-1",
          workspaceId: workspaceId,
          useDemoRepo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const repositories: GitRepository[] = [
        {
          gitOrganizationId: "git-organization-id",
          name: "git-repository-name",
          createdAt: new Date(),
          updatedAt: new Date(),
          id: "git-repository-id",
          gitOrganization: {
            provider: EnumGitProvider[currentGitProvider],
            id: "git-organization-id",
          } as unknown as GitOrganization,
        },
      ];

      await service.validateSubscriptionPlanLimitationsForWorkspace({
        workspaceId,
        currentUser: user,
        currentProjectId: projectId,
        projects,
        repositories,
      });

      expect(spyOnServiceGetBooleanEntitlement).toHaveBeenCalledWith(
        workspaceId,
        BillingFeature.IgnoreValidationCodeGeneration
      );

      expect(spyOnServiceGetBooleanEntitlement).not.toHaveBeenCalledWith(
        workspaceId,
        BillingFeature[currentGitProvider as keyof typeof BillingFeature]
      );
    }
  );
});
