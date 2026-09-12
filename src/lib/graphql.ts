import { gql } from "@apollo/client";

export const GLOBAL_SEARCH = gql`
  query GlobalSearch(
    $keyword: String!
    $workspaceId: String
    $entityTypes: [String!]
    $cursor: String
    $limit: Int!
  ) {
    globalSearch(
      keyword: $keyword
      workspaceId: $workspaceId
      entityTypes: $entityTypes
      cursor: $cursor
      limit: $limit
    )
  }
`;

export const RECORD_BY_ID = gql`
  query RecordById($tableId: String!, $recordId: ID!) {
    recordById(tableId: $tableId, recordId: $recordId)
  }
`;

export const GET_TABLE_DATA = gql`
  query GetTableData($tableId: String) {
    fields(tableId: $tableId)
    views(tableId: $tableId)
    hiddenFieldIds(tableId: $tableId)
    filters(tableId: $tableId)
    sorts(tableId: $tableId)
    groupConfig(tableId: $tableId)
  }
`;

export const QUERY_RECORDS = gql`
  query QueryRecords(
    $tableId: String
    $filters: [JSON!]
    $sorts: [JSON!]
    $offset: Int!
    $limit: Int!
  ) {
    queryRecords(
      tableId: $tableId
      filters: $filters
      sorts: $sorts
      offset: $offset
      limit: $limit
    )
  }
`;

export const ROW_PERMISSION_POLICY = gql`
  query RowPermissionPolicy($tableId: String) {
    rowPermissionPolicy(tableId: $tableId)
  }
`;

export const UPDATE_ROW_PERMISSION_POLICY = gql`
  mutation UpdateRowPermissionPolicy(
    $tableId: String!
    $mode: String!
    $memberFieldId: String
  ) {
    updateRowPermissionPolicy(
      tableId: $tableId
      mode: $mode
      memberFieldId: $memberFieldId
    )
  }
`;

export const TABLE_UPDATES = gql`
  subscription TableUpdates($tableId: String, $includeSnapshot: Boolean!) {
    tableUpdates(tableId: $tableId, includeSnapshot: $includeSnapshot)
  }
`;

export const INSERT_ROW = gql`
  mutation InsertRow($tableId: String, $data: JSON) {
    insertRow(tableId: $tableId, data: $data)
  }
`;

export const INSERT_ROWS = gql`
  mutation InsertRows($count: Int!, $tableId: String) {
    insertRows(count: $count, tableId: $tableId)
  }
`;

export const INSERT_ROWS_WITH_DATA = gql`
  mutation InsertRowsWithData($tableId: String, $recordsData: [JSON!]) {
    insertRowsWithData(tableId: $tableId, recordsData: $recordsData)
  }
`;

export const PREVIEW_CSV_IMPORT = gql`
  mutation PreviewCsvImport(
    $csvText: String!
    $tableId: String
    $mapping: [JSON!]
    $hasHeader: Boolean!
    $delimiter: String
  ) {
    previewCsvImport(
      csvText: $csvText
      tableId: $tableId
      mapping: $mapping
      hasHeader: $hasHeader
      delimiter: $delimiter
    )
  }
`;

export const IMPORT_CSV = gql`
  mutation ImportCsv(
    $csvText: String!
    $mapping: [JSON!]!
    $tableId: String
    $hasHeader: Boolean!
    $delimiter: String
    $skipInvalidRows: Boolean!
  ) {
    importCsv(
      csvText: $csvText
      mapping: $mapping
      tableId: $tableId
      hasHeader: $hasHeader
      delimiter: $delimiter
      skipInvalidRows: $skipInvalidRows
    )
  }
`;

export const EXPORT_XLSX = gql`
  mutation ExportXlsx(
    $tableId: String
    $fieldIds: [String!]
    $recordIds: [String!]
  ) {
    exportXlsx(
      tableId: $tableId
      fieldIds: $fieldIds
      recordIds: $recordIds
    )
  }
`;

export const ADD_FIELD = gql`
  mutation AddField($field: JSON!, $tableId: String, $index: Int) {
    addField(field: $field, tableId: $tableId, index: $index)
  }
`;

export const UPDATE_FIELD = gql`
  mutation UpdateField($fieldId: String!, $updates: JSON!, $tableId: String) {
    updateField(fieldId: $fieldId, updates: $updates, tableId: $tableId)
  }
`;

export const UPDATE_RECORD = gql`
  mutation UpdateRecord(
    $recordId: ID!
    $fieldId: String!
    $value: JSON
    $tableId: String
  ) {
    updateRecord(
      recordId: $recordId
      fieldId: $fieldId
      value: $value
      tableId: $tableId
    )
  }
`;


export const UPDATE_CALENDAR_RANGE = gql`
  mutation UpdateCalendarRange(
    $recordId: ID!
    $startFieldId: String!
    $startValue: JSON
    $endFieldId: String
    $endValue: JSON
    $tableId: String
  ) {
    updateCalendarRange(
      recordId: $recordId
      startFieldId: $startFieldId
      startValue: $startValue
      endFieldId: $endFieldId
      endValue: $endValue
      tableId: $tableId
    )
  }
`;

export const DELETE_FIELD = gql`
  mutation DeleteField($fieldId: String!, $tableId: String) {
    deleteField(fieldId: $fieldId, tableId: $tableId)
  }
`;

export const DELETE_RECORD = gql`
  mutation DeleteRecord($recordId: ID!, $tableId: String) {
    deleteRecord(recordId: $recordId, tableId: $tableId)
  }
`;

export const REORDER_FIELDS = gql`
  mutation ReorderFields($fieldOrder: [String!]!, $tableId: String) {
    reorderFields(fieldOrder: $fieldOrder, tableId: $tableId)
  }
`;

export const UPDATE_FIELD_VISIBILITY = gql`
  mutation UpdateFieldVisibility(
    $hiddenFieldIds: [String!]!
    $tableId: String
  ) {
    updateFieldVisibility(hiddenFieldIds: $hiddenFieldIds, tableId: $tableId)
  }
`;

export const ADD_FILTER = gql`
  mutation AddFilter($filter: JSON!, $tableId: String) {
    addFilter(filter: $filter, tableId: $tableId)
  }
`;

export const UPDATE_FILTER = gql`
  mutation UpdateFilter($filterId: String!, $updates: JSON!, $tableId: String) {
    updateFilter(filterId: $filterId, updates: $updates, tableId: $tableId)
  }
`;

export const DELETE_FILTER = gql`
  mutation DeleteFilter($filterId: String!, $tableId: String) {
    deleteFilter(filterId: $filterId, tableId: $tableId)
  }
`;

export const UPDATE_FILTERS = gql`
  mutation UpdateFilters($filters: [JSON!]!, $tableId: String) {
    updateFilters(filters: $filters, tableId: $tableId)
  }
`;

export const CLEAR_FILTERS = gql`
  mutation ClearFilters($tableId: String) {
    clearFilters(tableId: $tableId)
  }
`;

export const ADD_SORT = gql`
  mutation AddSort($sort: JSON!, $tableId: String) {
    addSort(sort: $sort, tableId: $tableId)
  }
`;

export const DELETE_SORT = gql`
  mutation DeleteSort($sortId: String!, $tableId: String) {
    deleteSort(sortId: $sortId, tableId: $tableId)
  }
`;

export const UPDATE_SORTS = gql`
  mutation UpdateSorts($sorts: [JSON!]!, $tableId: String) {
    updateSorts(sorts: $sorts, tableId: $tableId)
  }
`;

export const CLEAR_SORTS = gql`
  mutation ClearSorts($tableId: String) {
    clearSorts(tableId: $tableId)
  }
`;

export const UPDATE_GROUP_CONFIG = gql`
  mutation UpdateGroupConfig($config: JSON!, $tableId: String) {
    updateGroupConfig(config: $config, tableId: $tableId)
  }
`;

export const PUBLISH_YJS_UPDATE = gql`
  mutation PublishYjsUpdate(
    $docId: String!
    $update: String!
    $clientId: String
    $recordPatches: [RecordPatchInput!]
  ) {
    publishYjsUpdate(
      docId: $docId
      update: $update
      clientId: $clientId
      recordPatches: $recordPatches
    )
  }
`;

export const YJS_UPDATES = gql`
  subscription YjsUpdates($docId: String!) {
    yjsUpdates(docId: $docId)
  }
`;

export const TABLE_PRESENCE_UPDATES = gql`
  subscription TablePresenceUpdates($tableId: String!) {
    tablePresenceUpdates(tableId: $tableId)
  }
`;

export const UPSERT_TABLE_PRESENCE = gql`
  mutation UpsertTablePresence($tableId: String!, $sessionId: String!) {
    upsertTablePresence(tableId: $tableId, sessionId: $sessionId)
  }
`;

export const CLEAR_TABLE_PRESENCE = gql`
  mutation ClearTablePresence($tableId: String!, $sessionId: String!) {
    clearTablePresence(tableId: $tableId, sessionId: $sessionId)
  }
`;

export const UPDATE_VIEW_CONFIG = gql`
  mutation UpdateViewConfig(
    $viewId: String!
    $config: JSON!
    $tableId: String
  ) {
    updateViewConfig(viewId: $viewId, config: $config, tableId: $tableId)
  }
`;

export const CREATE_VIEW = gql`
  mutation CreateView($viewType: String!, $tableId: String, $name: String) {
    createView(viewType: $viewType, tableId: $tableId, name: $name)
  }
`;

export const RENAME_VIEW = gql`
  mutation RenameView($viewId: String!, $name: String!, $tableId: String) {
    renameView(viewId: $viewId, name: $name, tableId: $tableId)
  }
`;

export const COPY_VIEW = gql`
  mutation CopyView($viewId: String!, $tableId: String, $newName: String) {
    copyView(viewId: $viewId, tableId: $tableId, newName: $newName)
  }
`;

export const DELETE_VIEW = gql`
  mutation DeleteView($viewId: String!, $tableId: String) {
    deleteView(viewId: $viewId, tableId: $tableId)
  }
`;

export const GET_WORKSPACE = gql`
  query GetWorkspace($workspaceId: String) {
    workspace(workspaceId: $workspaceId)
  }
`;

export const GET_WORKSPACES = gql`
  query GetWorkspaces {
    workspaces
  }
`;

export const PROJECT_STEWARD_ASK = gql`
  mutation ProjectStewardAsk(
    $workspaceId: String!
    $tableIds: [String!]!
    $question: String!
    $projectId: String
    $timezone: String!
    $dueSoonDays: Int!
    $staleTaskDays: Int!
    $overloadHours: Float!
    $overloadWindowDays: Int!
    $maxRecords: Int!
    $model: String
  ) {
    projectStewardAsk(
      workspaceId: $workspaceId
      tableIds: $tableIds
      question: $question
      projectId: $projectId
      timezone: $timezone
      dueSoonDays: $dueSoonDays
      staleTaskDays: $staleTaskDays
      overloadHours: $overloadHours
      overloadWindowDays: $overloadWindowDays
      maxRecords: $maxRecords
      model: $model
    )
  }
`;

export const PROJECT_STEWARD_DIAGNOSIS = gql`
  query ProjectStewardDiagnosis($diagnosisId: String!) {
    projectStewardDiagnosis(diagnosisId: $diagnosisId)
  }
`;

export const PREVIEW_WORKLOAD_PLANNING = gql`
  mutation PreviewWorkloadPlanning(
    $workspaceId: String!
    $tableId: String!
    $recordIds: [String!]
    $deadline: String
    $teamSize: Int!
    $parallelStreams: Int
    $businessDomain: String
    $qualityBar: String!
    $sourceReference: JSON
  ) {
    previewWorkloadPlanning(
      workspaceId: $workspaceId
      tableId: $tableId
      recordIds: $recordIds
      deadline: $deadline
      teamSize: $teamSize
      parallelStreams: $parallelStreams
      businessDomain: $businessDomain
      qualityBar: $qualityBar
      sourceReference: $sourceReference
    )
  }
`;

export const APPLY_WORKLOAD_PLANNING = gql`
  mutation ApplyWorkloadPlanning(
    $batchId: String!
    $workspaceId: String!
    $tableId: String!
    $recordIds: [String!]
  ) {
    applyWorkloadPlanning(
      batchId: $batchId
      workspaceId: $workspaceId
      tableId: $tableId
      recordIds: $recordIds
    )
  }
`;

export const WORKLOAD_PLANNING_WHAT_IF = gql`
  mutation WorkloadPlanningWhatIf(
    $batchId: String!
    $teamSize: Int
    $parallelStreams: Int
    $deadline: String
  ) {
    workloadPlanningWhatIf(
      batchId: $batchId
      teamSize: $teamSize
      parallelStreams: $parallelStreams
      deadline: $deadline
    )
  }
`;

export const SUBMIT_WORKLOAD_PLANNING_FEEDBACK = gql`
  mutation SubmitWorkloadPlanningFeedback(
    $batchId: String!
    $recordId: String!
    $actualStoryPoints: Float
    $actualHours: Float
    $outcomeStatus: String!
    $accuracyRating: Int
    $notes: String!
  ) {
    submitWorkloadPlanningFeedback(
      batchId: $batchId
      recordId: $recordId
      actualStoryPoints: $actualStoryPoints
      actualHours: $actualHours
      outcomeStatus: $outcomeStatus
      accuracyRating: $accuracyRating
      notes: $notes
    )
  }
`;

export const WORKLOAD_PLANNING_BATCH = gql`
  query WorkloadPlanningBatch($batchId: String!) {
    workloadPlanningBatch(batchId: $batchId)
  }
`;

export const PREVIEW_TASK_PLANNING = gql`
  mutation PreviewTaskPlanning(
    $goal: String!
    $workspaceId: String!
    $targetTableId: String!
    $projectId: String
    $parentTaskId: String
    $selectedRecordIds: [String!]
    $sourceReference: JSON
    $deadline: String
    $teamSize: Int
    $granularity: String!
    $maxDepth: Int!
    $maxChildrenPerNode: Int!
    $locale: String!
    $timezone: String!
  ) {
    previewTaskPlanning(
      goal: $goal
      workspaceId: $workspaceId
      targetTableId: $targetTableId
      projectId: $projectId
      parentTaskId: $parentTaskId
      selectedRecordIds: $selectedRecordIds
      sourceReference: $sourceReference
      deadline: $deadline
      teamSize: $teamSize
      granularity: $granularity
      maxDepth: $maxDepth
      maxChildrenPerNode: $maxChildrenPerNode
      locale: $locale
      timezone: $timezone
    )
  }
`;

export const APPLY_TASK_PLANNING = gql`
  mutation ApplyTaskPlanning(
    $planId: String!
    $workspaceId: String!
    $targetTableId: String!
    $plan: JSON!
    $decisions: [JSON!]
    $allowRepeat: Boolean!
  ) {
    applyTaskPlanning(
      planId: $planId
      workspaceId: $workspaceId
      targetTableId: $targetTableId
      plan: $plan
      decisions: $decisions
      allowRepeat: $allowRepeat
    )
  }
`;

export const TASK_PLANNING_PLAN = gql`
  query TaskPlanningPlan($planId: String!) {
    taskPlanningPlan(planId: $planId)
  }
`;

export const PREVIEW_GOAL_WORKSPACE = gql`
  mutation PreviewGoalWorkspace(
    $goal: String!
    $workspaceId: String
    $parentId: String
    $teamSize: Int
    $deadline: String
    $currentBlueprint: JSON
    $instruction: String
  ) {
    previewGoalWorkspace(
      goal: $goal
      workspaceId: $workspaceId
      parentId: $parentId
      teamSize: $teamSize
      deadline: $deadline
      currentBlueprint: $currentBlueprint
      instruction: $instruction
    )
  }
`;

export const APPLY_GOAL_WORKSPACE_BLUEPRINT = gql`
  mutation ApplyGoalWorkspaceBlueprint(
    $traceId: String!
    $blueprint: JSON!
    $workspaceId: String!
    $parentId: String!
  ) {
    applyGoalWorkspaceBlueprint(
      traceId: $traceId
      blueprint: $blueprint
      workspaceId: $workspaceId
      parentId: $parentId
    )
  }
`;

export const CREATE_FOLDER = gql`
  mutation CreateFolder(
    $name: String!
    $parentId: String!
    $workspaceId: String
  ) {
    createFolder(name: $name, parentId: $parentId, workspaceId: $workspaceId)
  }
`;

export const CREATE_TABLE = gql`
  mutation CreateTable(
    $name: String!
    $parentId: String!
    $workspaceId: String
    $templateId: String
  ) {
    createTable(name: $name, parentId: $parentId, workspaceId: $workspaceId, templateId: $templateId)
  }
`;

export const CREATE_DASHBOARD = gql`
  mutation CreateDashboard($name: String!, $parentId: String!, $workspaceId: String) {
    createDashboard(name: $name, parentId: $parentId, workspaceId: $workspaceId)
  }
`;

export const RENAME_ITEM = gql`
  mutation RenameItem($itemId: String!, $name: String!, $workspaceId: String) {
    renameItem(itemId: $itemId, name: $name, workspaceId: $workspaceId)
  }
`;

export const DELETE_ITEM = gql`
  mutation DeleteItem($itemId: String!, $workspaceId: String) {
    deleteItem(itemId: $itemId, workspaceId: $workspaceId)
  }
`;

export const MOVE_ITEM = gql`
  mutation MoveItem(
    $itemId: String!
    $newParentId: String!
    $workspaceId: String
  ) {
    moveItem(itemId: $itemId, newParentId: $newParentId, workspaceId: $workspaceId)
  }
`;

export const COPY_TABLE = gql`
  mutation CopyTable(
    $tableId: String!
    $newParentId: String!
    $newName: String
    $workspaceId: String
  ) {
    copyTable(
      tableId: $tableId
      newParentId: $newParentId
      newName: $newName
      workspaceId: $workspaceId
    )
  }
`;

export const COPY_DASHBOARD = gql`
  mutation CopyDashboard(
    $dashboardId: String!
    $newParentId: String!
    $newName: String
    $workspaceId: String
  ) {
    copyDashboard(
      dashboardId: $dashboardId
      newParentId: $newParentId
      newName: $newName
      workspaceId: $workspaceId
    )
  }
`;

export const GET_DASHBOARD = gql`
  query GetDashboard($dashboardId: String!, $workspaceId: String) {
    dashboard(dashboardId: $dashboardId, workspaceId: $workspaceId)
  }
`;

export const GET_DASHBOARD_PUBLIC = gql`
  query GetDashboardPublic($token: String!) {
    dashboardPublic(token: $token)
  }
`;

export const DASHBOARD_WIDGET_DATA = gql`
  query DashboardWidgetData($widgetId: String!, $dashboardId: String) {
    dashboardWidgetData(widgetId: $widgetId, dashboardId: $dashboardId)
  }
`;

export const DASHBOARD_PUBLIC_WIDGET_DATA = gql`
  query DashboardPublicWidgetData($token: String!, $widgetId: String!) {
    dashboardPublicWidgetData(token: $token, widgetId: $widgetId)
  }
`;

export const UPDATE_DASHBOARD_META = gql`
  mutation UpdateDashboardMeta($dashboardId: String!, $updates: JSON!) {
    updateDashboardMeta(dashboardId: $dashboardId, updates: $updates)
  }
`;

export const ENSURE_DASHBOARD_PUBLIC_TOKEN = gql`
  mutation EnsureDashboardPublicToken($dashboardId: String!) {
    ensureDashboardPublicToken(dashboardId: $dashboardId)
  }
`;

export const CREATE_DASHBOARD_WIDGET = gql`
  mutation CreateDashboardWidget($dashboardId: String!, $widget: JSON!) {
    createDashboardWidget(dashboardId: $dashboardId, widget: $widget)
  }
`;

export const UPDATE_DASHBOARD_WIDGET = gql`
  mutation UpdateDashboardWidget($widgetId: String!, $updates: JSON!) {
    updateDashboardWidget(widgetId: $widgetId, updates: $updates)
  }
`;

export const DELETE_DASHBOARD_WIDGET = gql`
  mutation DeleteDashboardWidget($widgetId: String!) {
    deleteDashboardWidget(widgetId: $widgetId)
  }
`;

export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($name: String!) {
    createWorkspace(name: $name)
  }
`;

export const RENAME_WORKSPACE = gql`
  mutation RenameWorkspace($workspaceId: String!, $name: String!) {
    renameWorkspace(workspaceId: $workspaceId, name: $name)
  }
`;

export const DELETE_WORKSPACE = gql`
  mutation DeleteWorkspace($workspaceId: String!) {
    deleteWorkspace(workspaceId: $workspaceId)
  }
`;

export const INVITE_USER_TO_WORKSPACE = gql`
  mutation InviteUserToWorkspace(
    $email: String!
    $workspaceId: ID!
    $role: String!
  ) {
    inviteUserToWorkspace(
      email: $email
      workspaceId: $workspaceId
      role: $role
    ) {
      userId
      name
      email
      role
      resetToken
    }
  }
`;

export const WORKSPACE_MEMBERS = gql`
  query WorkspaceMembers($workspaceId: ID!) {
    workspaceMembers(workspaceId: $workspaceId) {
      userId
      name
      email
      role
    }
  }
`;

export const ITEM_ACCESS = gql`
  query ItemAccess($itemId: String!, $workspaceId: String) {
    itemAccess(itemId: $itemId, workspaceId: $workspaceId) {
      userId
      name
      email
      role
      permission
      inherited
    }
  }
`;

export const SET_ITEM_PERMISSION = gql`
  mutation SetItemPermission(
    $itemId: String!
    $userId: Int!
    $permission: String!
    $workspaceId: String
  ) {
    setItemPermission(
      itemId: $itemId
      userId: $userId
      permission: $permission
      workspaceId: $workspaceId
    )
  }
`;

export const REMOVE_ITEM_PERMISSION = gql`
  mutation RemoveItemPermission(
    $itemId: String!
    $userId: Int!
    $workspaceId: String
  ) {
    removeItemPermission(
      itemId: $itemId
      userId: $userId
      workspaceId: $workspaceId
    )
  }
`;

export const LEAVE_WORKSPACE = gql`
  mutation LeaveWorkspace($workspaceId: ID!) {
    leaveWorkspace(workspaceId: $workspaceId)
  }
`;

export const GET_TEMPLATES = gql`
  query GetTemplates(
    $workspaceId: String
    $scope: String
    $search: String
    $category: String
    $includeArchived: Boolean!
  ) {
    templates(
      workspaceId: $workspaceId
      scope: $scope
      search: $search
      category: $category
      includeArchived: $includeArchived
    )
  }
`;

export const GET_TEMPLATE_DETAIL = gql`
  query GetTemplateDetail(
    $templateId: String!
    $workspaceId: String
    $includeArchived: Boolean!
  ) {
    templateDetail(
      templateId: $templateId
      workspaceId: $workspaceId
      includeArchived: $includeArchived
    )
  }
`;


export const PREVIEW_AI_VISUAL_DESIGN = gql`
  mutation PreviewAiVisualDesign(
    $workspaceId: String!
    $prompt: String!
    $targetType: String!
    $tableId: String
    $parentId: String
    $dashboardId: String
    $currentProposal: JSON
    $instruction: String
    $model: String
  ) {
    previewAiVisualDesign(
      workspaceId: $workspaceId
      prompt: $prompt
      targetType: $targetType
      tableId: $tableId
      parentId: $parentId
      dashboardId: $dashboardId
      currentProposal: $currentProposal
      instruction: $instruction
      model: $model
    )
  }
`;

export const APPLY_AI_VISUAL_DESIGN = gql`
  mutation ApplyAiVisualDesign($planId: String!, $proposal: JSON) {
    applyAiVisualDesign(planId: $planId, proposal: $proposal)
  }
`;
