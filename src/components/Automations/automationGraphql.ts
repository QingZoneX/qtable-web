import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import type { AutomationExecution, AutomationRule } from "./automationTypes";

export const AUTOMATIONS = gql`
  query Automations($workspaceId: ID, $tableId: ID) {
    automations(workspaceId: $workspaceId, tableId: $tableId)
  }
`;

export const AUTOMATION = gql`
  query Automation($automationId: ID!) {
    automation(automationId: $automationId)
  }
`;

export const AUTOMATION_PREVIEW = gql`
  query AutomationPreview($automationId: ID!, $recordId: ID) {
    automationPreview(automationId: $automationId, recordId: $recordId)
  }
`;

export const AUTOMATION_EXECUTIONS = gql`
  query AutomationExecutions(
    $automationId: ID!
    $status: String
    $offset: Int!
    $limit: Int!
  ) {
    automationExecutions(
      automationId: $automationId
      status: $status
      offset: $offset
      limit: $limit
    )
  }
`;

export const AUTOMATION_EXECUTION = gql`
  query AutomationExecution($executionId: ID!) {
    automationExecution(executionId: $executionId)
  }
`;

export const VALIDATE_AUTOMATION = gql`
  mutation ValidateAutomation(
    $tableId: ID!
    $trigger: JSON!
    $conditions: JSON!
    $actions: JSON!
    $timezone: String!
    $maxRetries: Int!
  ) {
    validateAutomation(
      tableId: $tableId
      trigger: $trigger
      conditions: $conditions
      actions: $actions
      timezone: $timezone
      maxRetries: $maxRetries
    )
  }
`;

export const CREATE_AUTOMATION = gql`
  mutation CreateAutomation(
    $tableId: ID!
    $name: String!
    $description: String
    $trigger: JSON!
    $conditions: JSON!
    $actions: JSON!
    $timezone: String!
    $maxRetries: Int!
    $enabled: Boolean!
  ) {
    createAutomation(
      tableId: $tableId
      name: $name
      description: $description
      trigger: $trigger
      conditions: $conditions
      actions: $actions
      timezone: $timezone
      maxRetries: $maxRetries
      enabled: $enabled
    )
  }
`;

export const UPDATE_AUTOMATION = gql`
  mutation UpdateAutomation(
    $automationId: ID!
    $name: String
    $description: String
    $trigger: JSON
    $conditions: JSON
    $actions: JSON
    $timezone: String
    $maxRetries: Int
  ) {
    updateAutomation(
      automationId: $automationId
      name: $name
      description: $description
      trigger: $trigger
      conditions: $conditions
      actions: $actions
      timezone: $timezone
      maxRetries: $maxRetries
    )
  }
`;

export const SET_AUTOMATION_ENABLED = gql`
  mutation SetAutomationEnabled($automationId: ID!, $enabled: Boolean!) {
    setAutomationEnabled(automationId: $automationId, enabled: $enabled)
  }
`;

export const DELETE_AUTOMATION = gql`
  mutation DeleteAutomation($automationId: ID!) {
    deleteAutomation(automationId: $automationId)
  }
` as TypedDocumentNode<
  { deleteAutomation: boolean },
  { automationId: string }
>;

export const RUN_AUTOMATION = gql`
  mutation RunAutomation($automationId: ID!, $recordId: ID) {
    runAutomation(automationId: $automationId, recordId: $recordId)
  }
` as TypedDocumentNode<
  { runAutomation: AutomationExecution },
  { automationId: string; recordId?: string | null }
>;

export const RETRY_AUTOMATION_EXECUTION = gql`
  mutation RetryAutomationExecution($executionId: ID!) {
    retryAutomationExecution(executionId: $executionId)
  }
` as TypedDocumentNode<
  { retryAutomationExecution: AutomationExecution },
  { executionId: string }
>;

export type AutomationEnabledMutationResult = {
  setAutomationEnabled: AutomationRule;
};
