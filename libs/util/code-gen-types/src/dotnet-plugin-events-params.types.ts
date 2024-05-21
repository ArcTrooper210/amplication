import {
  Entity,
  EntityLookupField,
  ModuleContainer,
  ModuleAction,
  entityActions,
} from "./code-gen-types";
import { EventParams } from "./plugins.types";

export interface CreateEntityServiceBaseParams extends EventParams {
  entity: Entity;
  resourceName: string;
  apisDir: string;
  moduleContainers: ModuleContainer[];
  moduleActions: ModuleAction[];
  entities: Entity[];
}

export interface CreateEntityServiceParams extends EventParams {
  entity: Entity;
  resourceName: string;
  apisDir: string;
  entityActions: entityActions;
}

// export interface CreateCustomModuleServiceParams extends EventParams {
//   customModuleName: string;
//   templateMapping: { [key: string]: any };
//   serviceId: namedTypes.Identifier;
//   template: namedTypes.File;
//   moduleActions: ModuleAction[];
//   dtoNameToPath: Record<string, string>;
// }
export interface CreateEntityControllerParams extends EventParams {
  entity: Entity;
  resourceName: string;
  apisDir: string;
  entityActions: entityActions;
}

// export interface CreateCustomModuleControllerParams extends EventParams {
//   template: namedTypes.File;
//   customModuleName: string;
//   templateMapping: { [key: string]: any };
//   controllerId: namedTypes.Identifier;
//   serviceId: namedTypes.Identifier;
//   moduleActions: ModuleAction[];
//   customModuleServiceModule: string;
//   dtoNameToPath: Record<string, string>;
// }
export interface CreateEntityControllerBaseParams extends EventParams {
  entity: Entity;
  resourceName: string;
  apisDir: string;
  moduleContainers: ModuleContainer[];
  entityActions: entityActions;
}

export interface CreateEntityGrpcControllerParams extends EventParams {
  entity: Entity;
}
export interface CreateEntityGrpcControllerBaseParams extends EventParams {
  entity: Entity;
}

export interface CreateEntityInterfaceParams extends EventParams {
  entity: Entity;
  resourceName: string;
  apisDir: string;
  moduleContainers: ModuleContainer[];
  moduleActions: ModuleAction[];
  entities: Entity[];
}

export interface CreateEntityControllerToManyRelationMethodsParams
  extends EventParams {
  field: EntityLookupField;
  entity: Entity;
}

export interface CreateServerAuthParams extends EventParams {}

export interface CreateServerParams extends EventParams {}

export type VariableDictionary = {
  [variable: string]: string;
}[];

export interface CreateServerDotEnvParams extends EventParams {
  envVariables: VariableDictionary;
}

export interface CreateServerGitIgnoreParams extends EventParams {
  gitignorePaths: string[];
}

export interface CreateServerDockerComposeParams extends EventParams {
  fileContent: string;
  updateProperties: { [key: string]: any }[];
  outputFileName: string;
}

export interface CreateServerDockerComposeDevParams extends EventParams {
  fileContent: string;
  updateProperties: { [key: string]: any }[];
  outputFileName: string;
}

export interface CreateServerCsprojParams extends EventParams {
  packageReferences: {
    include: string;
    version: string;
    includeAssets?: string;
    privateAssets?: string;
  }[];
}

export interface CreateMessageBrokerParams extends EventParams {}

export interface CreateMessageBrokerTopicsEnumParams extends EventParams {}

export interface CreateMessageBrokerClientOptionsFactoryParams
  extends EventParams {}

export interface CreateMessageBrokerServiceParams extends EventParams {}
export interface CreateMessageBrokerServiceBaseParams extends EventParams {}

export interface CreateMainFileParams extends EventParams {}

export interface CreateSwaggerParams extends EventParams {
  fileDir: string;
  outputFileName: string;
}

export interface CreateSeedParams extends EventParams {
  fileDir: string;
  outputFileName: string;
  dtoNameToPath: Record<string, string>;
}
export interface CreateDTOsParams extends EventParams {
  entity: Entity;
  dtoName: string;
  dtoBasePath: string;
}
export interface LoadStaticFilesParams extends EventParams {
  source: string;
  basePath: string;
}

export interface CreateServerSecretsManagerParams extends EventParams {
  /**
   * Array of secretsName secrectKey pairs that will generate the SecretsNameKey enum.
   * SecrectKey is used by the Secrets Manager Service to retrieve the secret value
   */
  secretsNameKey: SecretsNameKey[];
}
export interface CreateEntityExtensionsParams extends EventParams {
  entity: Entity;
  resourceName: string;
  apisDir: string;
}

export interface SecretsNameKey {
  name: string;
  key: string;
}
