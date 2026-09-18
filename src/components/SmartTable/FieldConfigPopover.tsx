import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Input,
  Popover,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type {
  Field,
  FieldType,
  SelectOption,
} from "../../store/useSmartTableStore";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { client } from "../../lib/apollo";
import {
  ADD_FIELD,
  GET_WORKSPACE,
  UPDATE_FIELD,
  WORKSPACE_MEMBERS,
} from "../../lib/graphql";
import { GET_TABLE_FIELDS_ONLY } from "./relation/relationGraphql";
import { t } from "../../lib/i18nRuntime";
import { FieldTypeIcon } from "./FieldTypeIcon";
import {
  getRelationProperty,
  type RelationProperty,
} from "./relation/relationTypes";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type EditableFieldType = FieldType | "formula" | "relation";
type FormulaProperty = {
  formula?: string;
  resultType?: "auto" | "number" | "text" | "boolean" | "date";
};
type FieldWithFormula = Omit<Field, "type" | "property"> & {
  type: EditableFieldType;
  property?: Field["property"] & FormulaProperty;
};
type FieldWithRelation = Omit<Field, "type" | "property"> & {
  type: "relation";
  property?: Field["property"] & RelationProperty;
};
type FieldTypeOption = { value: EditableFieldType; label: string };

type WorkspaceNode = {
  type: "folder" | "table" | "dashboard";
  id: string;
  name: string;
  children?: WorkspaceNode[];
};

type WorkspaceTable = { id: string; name: string };

const fieldTypeOptions: FieldTypeOption[] = [
  { value: "text", label: "文本" },
  { value: "multiSelect", label: "多选" },
  { value: "select", label: "单选" },
  { value: "number", label: "数字" },
  { value: "date", label: "日期" },
  { value: "member", label: "成员" },
  { value: "rating", label: "评分" },
  { value: "url", label: "网址" },
  { value: "image", label: "图片" },
  { value: "attachment", label: "附件" },
  { value: "progress", label: "进度" },
  { value: "email", label: "邮箱" },
  { value: "phone", label: "电话" },
  { value: "formula", label: "公式" },
  { value: "relation", label: "关联记录" },
  { value: "autoNumber", label: "自动编号" },
];

const optionColors = [
  "#F79E9B",
  "#FF9C4C",
  "#FBD355",
  "#A1C10C",
  "#5CD168",
  "#32D6C0",
  "#3DC3F7",
  "#94B3FF",
  "#F598CC",
  "#C7A9FC",
  "#DEE0E3",
];

const dateFormatOptions = [
  { label: "年/月/日", value: "YYYY/MM/DD" },
  { label: "年-月-日", value: "YYYY-MM-DD" },
  { label: "日/月/年", value: "DD/MM/YYYY" },
  { label: "年-月", value: "YYYY-MM" },
  { label: "月-日", value: "MM-DD" },
];

const precisionOptions = Array.from({ length: 7 }, (_, precision) => ({
  label: precision === 0 ? "0" : `0.${"0".repeat(precision)}`,
  value: precision,
}));

const FORMULA_FUNCTIONS = [
  "IF",
  "CONCAT",
  "SUM",
  "AVERAGE",
  "MIN",
  "MAX",
  "ROUND",
  "ABS",
  "LEN",
  "LOWER",
  "UPPER",
  "COALESCE",
  "AND",
  "OR",
  "NOT",
] as const;

const formulaFunctionTemplates: Record<string, string> = {
  IF: "IF(, , )",
  CONCAT: "CONCAT(, )",
  SUM: "SUM()",
  AVERAGE: "AVERAGE()",
  MIN: "MIN()",
  MAX: "MAX()",
  ROUND: "ROUND(, 2)",
  ABS: "ABS()",
  LEN: "LEN()",
  LOWER: "LOWER()",
  UPPER: "UPPER()",
  COALESCE: "COALESCE(, )",
  AND: "AND(, )",
  OR: "OR(, )",
  NOT: "NOT()",
};

const FIELD_REF_RE = /\{\{([A-Za-z0-9_.:-]+)\}\}/g;

const getFormulaProperty = (field?: Field | null): FormulaProperty =>
  ((field?.property || {}) as Field["property"] & FormulaProperty) || {};

const buildDefaultOptions = (labels: string[]) => {
  const base = Date.now();
  return labels.map((label, index) => ({
    id: `opt_${base}_${index}`,
    label,
    color: optionColors[index % optionColors.length],
  }));
};

type WorkspaceMemberCandidate = {
  userId: number;
  name: string;
  email: string;
  role: string;
};

const toMemberOption = (member: WorkspaceMemberCandidate): SelectOption => ({
  id: String(member.userId),
  label: member.name || member.email || String(member.userId),
  color: "#F3F4F6",
});

const flattenWorkspaceTables = (root?: WorkspaceNode | null): WorkspaceTable[] => {
  if (!root) return [];
  const result: WorkspaceTable[] = [];
  const walk = (node: WorkspaceNode) => {
    if (node.type === "table") result.push({ id: node.id, name: node.name });
    node.children?.forEach(walk);
  };
  walk(root);
  return result;
};

export type FieldConfigDraft = {
  name: string;
  type: FieldType;
  options?: SelectOption[];
  property?: Field["property"];
};

type FieldConfigPopoverProps = {
  open: boolean;
  mode: "add" | "edit";
  position: { x: number; y: number };
  field?: Field | null;
  onClose: () => void;
  onSubmit: (draft: FieldConfigDraft) => void;
};

type FormulaCheck = { valid: boolean; error?: string };

const extractFormulaRefs = (expression: string): string[] =>
  Array.from(expression.matchAll(FIELD_REF_RE), (match) => match[1]);

const validateFormula = (
  expression: string,
  fields: Field[],
  currentFieldId?: string,
): FormulaCheck => {
  const formula = expression.trim();
  if (!formula) return { valid: false, error: "请输入公式表达式" };
  if (formula.length > 2000) {
    return { valid: false, error: "公式长度不能超过 2000 个字符" };
  }
  const refs = extractFormulaRefs(formula);
  if (refs.length > 64) {
    return { valid: false, error: "单个公式最多引用 64 个字段" };
  }
  const existingIds = new Set(fields.map((item) => item.id));
  const missingRef = refs.find((ref) => !existingIds.has(ref));
  if (missingRef) return { valid: false, error: `引用字段不存在：${missingRef}` };
  if (currentFieldId && refs.includes(currentFieldId)) {
    return { valid: false, error: "公式不能直接引用自身" };
  }

  const withoutStrings = formula.replace(/(['"])(?:\\.|(?!\1).)*\1/g, "''");
  const withoutRefs = withoutStrings.replace(FIELD_REF_RE, "0");
  if (/\b(lambda|import|exec|eval|class|def|yield|await|for|while|with|try)\b/i.test(withoutRefs)) {
    return { valid: false, error: "公式包含不支持的表达式" };
  }
  if (/[A-Za-z_]\w*\s*\./.test(withoutRefs)) {
    return { valid: false, error: "公式不支持属性访问" };
  }
  const functionNames = Array.from(
    withoutRefs.matchAll(/\b([A-Za-z_]\w*)\s*\(/g),
    (match) => match[1].toUpperCase(),
  );
  const unknownFunction = functionNames.find(
    (fn) => !FORMULA_FUNCTIONS.includes(fn as (typeof FORMULA_FUNCTIONS)[number]),
  );
  if (unknownFunction) {
    return { valid: false, error: `不支持的函数：${unknownFunction}` };
  }
  let depth = 0;
  for (const char of withoutStrings) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return { valid: false, error: "公式括号不匹配" };
  }
  if (depth !== 0) return { valid: false, error: "公式括号不匹配" };

  if (currentFieldId) {
    const dependencies = new Map<string, string[]>();
    fields.forEach((item) => {
      if (String(item.type) !== "formula") return;
      const itemFormula =
        item.id === currentFieldId
          ? formula
          : getFormulaProperty(item).formula || "";
      dependencies.set(item.id, extractFormulaRefs(itemFormula));
    });
    dependencies.set(currentFieldId, refs);
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const hasCycle = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      for (const dependency of dependencies.get(id) || []) {
        if (dependencies.has(dependency) && hasCycle(dependency)) return true;
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    if (hasCycle(currentFieldId)) {
      return { valid: false, error: "检测到公式循环依赖" };
    }
  }
  return { valid: true };
};

const saveErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    const match = error.message.match(/(?:message[:=]\s*)?([^\n]+)/i);
    return match?.[1] || error.message;
  }
  return fallback;
};

export function FieldConfigPopover({
  open,
  mode,
  position,
  field,
  onClose,
  onSubmit,
}: FieldConfigPopoverProps) {
  const { fields, currentTableId, currentTableName } = useSmartTableStore();
  const runtimeInitialType = String(field?.type || "text") as EditableFieldType;
  const initialType = fieldTypeOptions.some((item) => item.value === runtimeInitialType)
    ? runtimeInitialType
    : "text";
  const initialOptions =
    initialType === "select" || initialType === "multiSelect"
      ? field?.options ?? buildDefaultOptions(["选项 1", "选项 2", "选项 3"])
      : [];
  const formulaProperty = getFormulaProperty(field);
  const relationProperty = getRelationProperty(field);

  const [name, setName] = useState(field?.name ?? "新建字段");
  const [type, setType] = useState<EditableFieldType>(initialType);
  const [options, setOptions] = useState<SelectOption[]>(initialOptions);
  const [format, setFormat] = useState(field?.property?.format ?? "YYYY-MM-DD");
  const [precision, setPrecision] = useState(field?.property?.precision ?? 2);
  const [thousandsSeparator, setThousandsSeparator] = useState(
    field?.property?.thousandsSeparator ?? true,
  );
  const [prefix, setPrefix] = useState(
    field?.property?.prefix ?? field?.property?.currency ?? "",
  );
  const [suffix, setSuffix] = useState(
    field?.property?.suffix ?? field?.property?.unit ?? "",
  );
  const [autoNumberDigits, setAutoNumberDigits] = useState(
    field?.property?.digits ?? 3,
  );
  const [autoNumberStart, setAutoNumberStart] = useState(
    field?.property?.start ?? 1,
  );
  const [maxValue, setMaxValue] = useState(
    field?.property?.max ?? (initialType === "progress" ? 100 : 5),
  );
  const [formula, setFormula] = useState(formulaProperty.formula ?? "");
  const [formulaCursor, setFormulaCursor] = useState(formula.length);
  const [formulaSuggestionIndex, setFormulaSuggestionIndex] = useState(0);
  const [relationTargetTableId, setRelationTargetTableId] = useState(
    relationProperty.targetTableId ?? "",
  );
  const [relationDisplayFieldId, setRelationDisplayFieldId] = useState(
    relationProperty.displayFieldId ?? "",
  );
  const [relationMultiple, setRelationMultiple] = useState(
    relationProperty.multiple !== false,
  );
  const [memberMultiple, setMemberMultiple] = useState(
    field?.property?.multiple !== false,
  );
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberCandidate[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [workspaceTables, setWorkspaceTables] = useState<WorkspaceTable[]>([]);
  const [relationTargetFields, setRelationTargetFields] = useState<Field[]>([]);
  const [relationConfigLoading, setRelationConfigLoading] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredTypeOptions = useMemo(() => {
    const keyword = typeSearch.trim().toLowerCase();
    if (!keyword) return fieldTypeOptions;
    return fieldTypeOptions.filter((option) =>
      option.label.toLowerCase().includes(keyword),
    );
  }, [typeSearch]);

  const availableFormulaFields = useMemo(
    () => fields.filter((item) => item.id !== field?.id),
    [field?.id, fields],
  );

  const activeFormulaToken = useMemo(() => {
    const beforeCursor = formula.slice(0, formulaCursor);
    const openIndex = beforeCursor.lastIndexOf("{{");
    const closeIndex = beforeCursor.lastIndexOf("}}");
    if (openIndex < 0 || openIndex < closeIndex) return null;
    const query = beforeCursor.slice(openIndex + 2);
    if (query.includes("{") || query.includes("}")) return null;
    return { start: openIndex, query: query.trim().toLowerCase() };
  }, [formula, formulaCursor]);

  const formulaSuggestions = useMemo(() => {
    if (!activeFormulaToken) return [];
    return availableFormulaFields
      .filter((item) => {
        const query = activeFormulaToken.query;
        return (
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [activeFormulaToken, availableFormulaFields]);

  const formulaCheck = useMemo(
    () => validateFormula(formula, fields, field?.id),
    [field?.id, fields, formula],
  );

  useEffect(() => {
    if (type !== "member") return;
    const workspaceId = localStorage.getItem("qtable.workspaceId") || "";
    if (!workspaceId) {
      setWorkspaceMembers([]);
      return;
    }
    let active = true;
    setMemberLoading(true);
    void client
      .query({
        query: WORKSPACE_MEMBERS,
        variables: { workspaceId },
        fetchPolicy: "network-only",
      })
      .then((result) => {
        if (!active) return;
        const members = (
          result as { data?: { workspaceMembers?: WorkspaceMemberCandidate[] } }
        ).data?.workspaceMembers || [];
        setWorkspaceMembers(members);
        setOptions(members.map(toMemberOption));
      })
      .catch(() => {
        if (active) {
          setWorkspaceMembers([]);
          setOptions([]);
        }
      })
      .finally(() => {
        if (active) setMemberLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    if (type !== "relation") return;
    let active = true;
    const loadWorkspaceTables = async () => {
      const fallback = currentTableId
        ? [{ id: currentTableId, name: currentTableName || "当前数据表" }]
        : [];
      const workspaceId = localStorage.getItem("qtable.workspaceId") || "";
      if (!workspaceId) {
        if (active) setWorkspaceTables(fallback);
        return;
      }
      setRelationConfigLoading(true);
      try {
        const result = await client.query({
          query: GET_WORKSPACE,
          variables: { workspaceId },
          fetchPolicy: "network-only",
        });
        const root = (
          result as { data?: { workspace?: { root?: WorkspaceNode } } }
        ).data?.workspace?.root;
        const tables = flattenWorkspaceTables(root);
        if (currentTableId && !tables.some((item) => item.id === currentTableId)) {
          tables.unshift(...fallback);
        }
        if (active) setWorkspaceTables(tables);
      } catch {
        if (active) setWorkspaceTables(fallback);
      } finally {
        if (active) setRelationConfigLoading(false);
      }
    };
    void loadWorkspaceTables();
    return () => {
      active = false;
    };
  }, [currentTableId, currentTableName, type]);

  useEffect(() => {
    if (type !== "relation" || !relationTargetTableId) {
      setRelationTargetFields([]);
      return;
    }
    if (relationTargetTableId === currentTableId) {
      setRelationTargetFields(fields);
      if (
        relationDisplayFieldId &&
        !fields.some((item) => item.id === relationDisplayFieldId)
      ) {
        setRelationDisplayFieldId(fields[0]?.id || "");
      } else if (!relationDisplayFieldId && fields.length > 0) {
        setRelationDisplayFieldId(fields[0].id);
      }
      return;
    }

    let active = true;
    setRelationConfigLoading(true);
    void client
      .query({
        query: GET_TABLE_FIELDS_ONLY,
        variables: { tableId: relationTargetTableId },
        fetchPolicy: "network-only",
      })
      .then((result) => {
        if (!active) return;
        const targetFields = (
          result as { data?: { fields?: Field[] } }
        ).data?.fields || [];
        setRelationTargetFields(targetFields);
        setRelationDisplayFieldId((current) =>
          current && targetFields.some((item) => item.id === current)
            ? current
            : targetFields[0]?.id || "",
        );
      })
      .catch(() => {
        if (active) setRelationTargetFields([]);
      })
      .finally(() => {
        if (active) setRelationConfigLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentTableId, fields, relationDisplayFieldId, relationTargetTableId, type]);

  const insertFormulaText = (text: string, replaceActiveToken = false) => {
    let start = formulaCursor;
    if (replaceActiveToken && activeFormulaToken) start = activeFormulaToken.start;
    const next = `${formula.slice(0, start)}${text}${formula.slice(formulaCursor)}`;
    setFormula(next);
    setFormulaCursor(start + text.length);
    setFormulaSuggestionIndex(0);
  };

  const insertFormulaField = (target: Field, replaceActiveToken = false) => {
    insertFormulaText(`{{${target.id}}}`, replaceActiveToken);
  };

  const handleTypeChange = (nextType: EditableFieldType) => {
    setType(nextType);
    if (
      (nextType === "select" || nextType === "multiSelect") &&
      options.length === 0
    ) {
      setOptions(buildDefaultOptions(["选项 1", "选项 2", "选项 3"]));
    }
    if (nextType === "member") {
      setOptions(workspaceMembers.map(toMemberOption));
    }
    if (nextType === "rating") setMaxValue(5);
    if (nextType === "progress") setMaxValue(100);
    if (nextType === "autoNumber") {
      setAutoNumberDigits((current) => current || 3);
      setAutoNumberStart((current) => current || 1);
    }
    if (nextType === "formula" && !formula) setFormula("{{");
  };

  const handleAddOption = () => {
    const next: SelectOption = {
      id: `opt_${Date.now()}_${options.length}`,
      label: `选项 ${options.length + 1}`,
      color: optionColors[options.length % optionColors.length],
    };
    setOptions((previous) => [...previous, next]);
  };

  const handleUpdateOption = (id: string, updates: Partial<SelectOption>) => {
    setOptions((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const saveFormulaField = async () => {
    if (!formulaCheck.valid) {
      message.error(formulaCheck.error || "请检查公式");
      return;
    }
    setSaving(true);
    const fieldName = name.trim() || "公式";
    try {
      if (mode === "add") {
        const nextField: FieldWithFormula = {
          id: `f_${Date.now()}`,
          name: fieldName,
          type: "formula",
          property: { formula: formula.trim(), resultType: "auto" },
        };
        const result = await client.mutate({
          mutation: ADD_FIELD,
          variables: {
            field: nextField,
            tableId: currentTableId ?? undefined,
            index: fields.length,
          },
        });
        const serverField = (
          result as { data?: { addField?: FieldWithFormula } }
        ).data?.addField || nextField;
        useSmartTableStore.setState((state) => {
          if (state.fields.some((item) => item.id === serverField.id)) return {};
          return { fields: [...state.fields, serverField as unknown as Field] };
        });
        message.success("公式字段已新增");
      } else if (field) {
        const updates = {
          name: fieldName,
          type: "formula",
          options: undefined,
          property: { formula: formula.trim(), resultType: "auto" },
        };
        const result = await client.mutate({
          mutation: UPDATE_FIELD,
          variables: {
            fieldId: field.id,
            updates,
            tableId: currentTableId ?? undefined,
          },
        });
        const serverField = (
          result as { data?: { updateField?: FieldWithFormula } }
        ).data?.updateField;
        useSmartTableStore.setState((state) => ({
          fields: state.fields.map((item) =>
            item.id === field.id
              ? ((serverField || { ...item, ...updates }) as unknown as Field)
              : item,
          ),
        }));
        message.success("公式字段已更新");
      }
      onClose();
    } catch (error) {
      message.error(saveErrorMessage(error, "公式字段保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const saveRelationField = async () => {
    if (!relationTargetTableId) {
      message.error("请选择要关联的数据表");
      return;
    }
    setSaving(true);
    const fieldName = name.trim() || "关联记录";
    const property: RelationProperty = {
      targetTableId: relationTargetTableId,
      displayFieldId: relationDisplayFieldId || undefined,
      multiple: relationMultiple,
    };
    try {
      if (mode === "add") {
        const nextField: FieldWithRelation = {
          id: `f_${Date.now()}`,
          name: fieldName,
          type: "relation",
          property,
        };
        const result = await client.mutate({
          mutation: ADD_FIELD,
          variables: {
            field: nextField,
            tableId: currentTableId ?? undefined,
            index: fields.length,
          },
        });
        const serverField = (
          result as { data?: { addField?: FieldWithRelation } }
        ).data?.addField || nextField;
        useSmartTableStore.setState((state) => {
          if (state.fields.some((item) => item.id === serverField.id)) return {};
          return { fields: [...state.fields, serverField as unknown as Field] };
        });
        message.success("关联字段已新增");
      } else if (field) {
        const updates = {
          name: fieldName,
          type: "relation",
          options: undefined,
          property,
        };
        const result = await client.mutate({
          mutation: UPDATE_FIELD,
          variables: {
            fieldId: field.id,
            updates,
            tableId: currentTableId ?? undefined,
          },
        });
        const serverField = (
          result as { data?: { updateField?: FieldWithRelation } }
        ).data?.updateField;
        useSmartTableStore.setState((state) => ({
          fields: state.fields.map((item) =>
            item.id === field.id
              ? ((serverField || { ...item, ...updates }) as unknown as Field)
              : item,
          ),
        }));
        message.success("关联字段已更新");
      }
      onClose();
    } catch (error) {
      message.error(saveErrorMessage(error, "关联字段保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const saveAutoNumberField = async () => {
    const normalizedPrefix = prefix.trim();
    const digits = Math.max(1, Math.min(12, Math.trunc(autoNumberDigits || 3)));
    const start = Math.max(1, Math.trunc(autoNumberStart || 1));
    if (normalizedPrefix.length > 64) {
      message.error("自动编号前缀不能超过 64 个字符");
      return;
    }

    setSaving(true);
    const fieldName = name.trim() || "自动编号";
    const property = {
      prefix: normalizedPrefix,
      digits,
      start,
    };

    try {
      if (mode === "add") {
        const nextField = {
          id: `f_${Date.now()}`,
          name: fieldName,
          type: "autoNumber" as const,
          property,
        };
        const result = await client.mutate({
          mutation: ADD_FIELD,
          variables: {
            field: nextField,
            tableId: currentTableId ?? undefined,
            index: fields.length,
          },
        });
        const serverField = (
          result as { data?: { addField?: Field } }
        ).data?.addField;
        if (!serverField) throw new Error("自动编号字段创建失败");
        useSmartTableStore.setState((state) => {
          if (state.fields.some((item) => item.id === serverField.id)) return {};
          return { fields: [...state.fields, serverField] };
        });
        message.success("自动编号字段已新增");
      } else if (field) {
        const updates = {
          name: fieldName,
          type: "autoNumber" as const,
          options: undefined,
          property,
        };
        const result = await client.mutate({
          mutation: UPDATE_FIELD,
          variables: {
            fieldId: field.id,
            updates,
            tableId: currentTableId ?? undefined,
          },
        });
        const serverField = (
          result as { data?: { updateField?: Field } }
        ).data?.updateField;
        if (!serverField) throw new Error("自动编号字段更新失败");
        useSmartTableStore.setState((state) => ({
          fields: state.fields.map((item) =>
            item.id === field.id ? serverField : item,
          ),
        }));
        message.success("自动编号字段已更新");
      }
      onClose();
    } catch (error) {
      message.error(saveErrorMessage(error, "自动编号字段保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (type === "formula") {
      void saveFormulaField();
      return;
    }
    if (type === "relation") {
      void saveRelationField();
      return;
    }
    if (type === "autoNumber") {
      void saveAutoNumberField();
      return;
    }

    const payload: FieldConfigDraft = {
      name: name.trim() || "新建字段",
      type,
    };
    if (type === "select" || type === "multiSelect") {
      payload.options = options
        .map((item) => ({ ...item, label: item.label.trim() }))
        .filter((item) => item.label);
    }
    if (type === "member") {
      // Live workspace members are included only for immediate local rendering;
      // the backend intentionally strips this snapshot and rehydrates it later.
      payload.options = workspaceMembers.map(toMemberOption);
      payload.property = {
        ...(field?.property || {}),
        multiple: memberMultiple,
      };
    }
    if (type === "date") payload.property = { format: format || "YYYY-MM-DD" };
    if (type === "number") {
      payload.property = {
        precision,
        thousandsSeparator,
        prefix: prefix || undefined,
        suffix: suffix || undefined,
      };
    }
    if (type === "rating") payload.property = { max: maxValue || 5 };
    if (type === "progress") payload.property = { max: maxValue || 100 };
    onSubmit(payload);
  };

  const renderTypeSelector = () => (
    <Popover
      content={
        <div style={{ width: 260 }}>
          <Input
            value={typeSearch}
            placeholder="搜索字段类型"
            onChange={(event) => setTypeSearch(event.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {filteredTypeOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  handleTypeChange(option.value);
                  setTypePopoverOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: option.value === type ? "#EEF2FF" : "transparent",
                  color: option.value === type ? "#4338CA" : "#111827",
                  fontSize: 13,
                  marginBottom: 4,
                  fontWeight: option.value === type ? 600 : 400,
                }}
              >
                <FieldTypeIcon type={option.value} style={{ fontSize: 14 }} />
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        </div>
      }
      trigger="click"
      placement="bottomLeft"
      open={typePopoverOpen}
      onOpenChange={setTypePopoverOpen}
    >
      <Button
        style={{
          width: "100%",
          justifyContent: "space-between",
          height: 36,
          borderRadius: 8,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FieldTypeIcon type={type} />
          {fieldTypeOptions.find((option) => option.value === type)?.label ||
            "选择字段类型"}
        </span>
        <DownOutlined />
      </Button>
    </Popover>
  );

  const renderOptionsEditor = () => (
    <div style={{ marginTop: 16 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>选项内容</Text>
      <div style={{ marginTop: 10 }}>
        {options.map((option, index) => (
          <div
            key={option.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 8px",
              border: "1px solid #E5E7EB",
              borderRadius: 9,
              marginBottom: 8,
            }}
          >
            <Select
              value={option.color}
              onChange={(color) => handleUpdateOption(option.id, { color })}
              popupMatchSelectWidth={false}
              style={{ width: 54 }}
              options={optionColors.map((color) => ({
                value: color,
                label: (
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: color,
                    }}
                  />
                ),
              }))}
            />
            <Input
              value={option.label}
              onChange={(event) =>
                handleUpdateOption(option.id, { label: event.target.value })
              }
              size="small"
              placeholder={`选项 ${index + 1}`}
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() =>
                setOptions((previous) =>
                  previous.filter((item) => item.id !== option.id),
                )
              }
            />
          </div>
        ))}
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={handleAddOption}
          disabled={options.length >= 30}
          style={{ paddingLeft: 0, color: "#4F46E5" }}
        >
          添加选项
        </Button>
      </div>
    </div>
  );

  const renderFormulaEditor = () => {
    const referencedIds = new Set(extractFormulaRefs(formula));
    const referencedFields = fields.filter((item) => referencedIds.has(item.id));
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>公式表达式</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formula.length}/2000</Text>
        </div>
        <div style={{ position: "relative", marginTop: 8 }}>
          <TextArea
            value={formula}
            autoSize={{ minRows: 5, maxRows: 10 }}
            placeholder="例如：{{价格字段}} * {{数量字段}}；输入 {{ 可搜索字段"
            onChange={(event) => {
              setFormula(event.target.value);
              setFormulaCursor(event.target.selectionStart ?? event.target.value.length);
              setFormulaSuggestionIndex(0);
            }}
            onSelect={(event) => {
              const target = event.target as HTMLTextAreaElement;
              setFormulaCursor(target.selectionStart ?? formula.length);
            }}
            onKeyDown={(event) => {
              if (!activeFormulaToken || formulaSuggestions.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setFormulaSuggestionIndex(
                  (index) => (index + 1) % formulaSuggestions.length,
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setFormulaSuggestionIndex(
                  (index) =>
                    (index - 1 + formulaSuggestions.length) %
                    formulaSuggestions.length,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                const suggestion =
                  formulaSuggestions[formulaSuggestionIndex] || formulaSuggestions[0];
                if (suggestion) insertFormulaField(suggestion, true);
              } else if (event.key === "Escape") {
                setFormulaCursor(0);
              }
            }}
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
            }}
          />
          {activeFormulaToken && formulaSuggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                top: "100%",
                zIndex: 20,
                marginTop: 4,
                padding: 6,
                maxHeight: 210,
                overflowY: "auto",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 9,
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
              }}
            >
              {formulaSuggestions.map((item, index) => (
                <div
                  key={item.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertFormulaField(item, true)}
                  style={{
                    padding: "7px 9px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background:
                      index === formulaSuggestionIndex ? "#EEF2FF" : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{item.name}</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>{item.id}</Text>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: activeFormulaToken && formulaSuggestions.length > 0 ? 224 : 10 }}>
          <Select
            showSearch
            allowClear
            value={undefined}
            placeholder="搜索并插入字段"
            optionFilterProp="label"
            style={{ width: "100%" }}
            onChange={(fieldId) => {
              const target = availableFormulaFields.find((item) => item.id === fieldId);
              if (target) insertFormulaField(target);
            }}
            options={availableFormulaFields.map((item) => ({
              label: `${item.name} · ${item.id}`,
              value: item.id,
            }))}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>常用函数</Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
            {FORMULA_FUNCTIONS.map((fn) => (
              <Tag
                key={fn}
                style={{ cursor: "pointer", marginInlineEnd: 0 }}
                onClick={() =>
                  insertFormulaText(formulaFunctionTemplates[fn] || `${fn}()`)
                }
              >
                {fn}
              </Tag>
            ))}
          </div>
        </div>

        {referencedFields.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>已引用字段</Text>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
              {referencedFields.map((item) => (
                <Tag key={item.id}>{item.name}</Tag>
              ))}
            </div>
          </div>
        )}

        <Alert
          type={formulaCheck.valid ? "success" : "warning"}
          showIcon
          style={{ marginTop: 12 }}
          message={formulaCheck.valid ? "公式结构检查通过" : formulaCheck.error}
          description="保存时后端还会执行安全语法、引用和循环依赖校验；公式值为只读派生结果。"
        />
        <Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0, fontSize: 11 }}>
          字段引用实际保存为稳定 ID，例如 <code>{"{{f_price}}"}</code>，因此重命名字段不会破坏公式。
        </Paragraph>
      </div>
    );
  };

  const renderRelationEditor = () => (
    <div style={{ marginTop: 14 }}>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>关联到数据表</Text>
        <Select
          showSearch
          optionFilterProp="label"
          loading={relationConfigLoading}
          value={relationTargetTableId || undefined}
          placeholder="选择当前工作区中的数据表"
          style={{ width: "100%", marginTop: 7 }}
          onChange={(tableId) => {
            setRelationTargetTableId(tableId);
            setRelationDisplayFieldId("");
          }}
          options={workspaceTables.map((item) => ({
            value: item.id,
            label:
              item.id === currentTableId ? `${item.name}（当前表）` : item.name,
          }))}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>显示字段</Text>
        <Select
          showSearch
          optionFilterProp="label"
          loading={relationConfigLoading}
          disabled={!relationTargetTableId}
          value={relationDisplayFieldId || undefined}
          placeholder="默认使用目标表第一个字段"
          style={{ width: "100%", marginTop: 7 }}
          onChange={setRelationDisplayFieldId}
          options={relationTargetFields.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          allowClear
        />
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "12px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #F1F5F9",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div>
          <Text style={{ fontSize: 13 }}>允许关联多条记录</Text>
          <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
            关闭后每行只能选择一条目标记录
          </Text>
        </div>
        <Switch checked={relationMultiple} onChange={setRelationMultiple} />
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 14 }}
        message="关联只保存目标记录 ID"
        description="标题由目标表实时解析；目标记录改名后无需回写。修改目标表或单/多选模式时，服务端会校验并规范化已有关系数据。"
      />
    </div>
  );

  const renderConfigSection = () => {
    if (type === "formula") return renderFormulaEditor();
    if (type === "relation") return renderRelationEditor();
    if (type === "member") {
      return (
        <div style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            message="成员来自当前工作空间"
            description="人员候选与工作空间成员自动同步，不在字段中保存成员副本。成员退出工作空间后将不能再被新选择。"
          />
          <div style={{ marginTop: 14 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>选择方式</Text>
            <Select
              value={memberMultiple ? "multiple" : "single"}
              onChange={(value) => setMemberMultiple(value === "multiple")}
              options={[
                { value: "single", label: "单选：每行只能选择 1 人" },
                { value: "multiple", label: "多选：每行可选择多个人" },
              ]}
              style={{ width: "100%", marginTop: 7 }}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前可选成员 ({workspaceMembers.length})
            </Text>
            <Select
              mode="multiple"
              disabled
              loading={memberLoading}
              value={workspaceMembers.map((member) => String(member.userId))}
              options={workspaceMembers.map((member) => ({
                value: String(member.userId),
                label: `${member.name || member.email} · ${member.role}`,
              }))}
              placeholder={memberLoading ? "正在加载工作空间成员..." : "当前工作空间暂无成员"}
              style={{ width: "100%", marginTop: 7 }}
              maxTagCount="responsive"
            />
          </div>
        </div>
      );
    }
    if (type === "select" || type === "multiSelect") {
      return renderOptionsEditor();
    }
    if (type === "date") {
      return (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>日期格式</Text>
          <Select
            value={format}
            onChange={setFormat}
            options={dateFormatOptions}
            style={{ width: "100%", marginTop: 9 }}
          />
        </div>
      );
    }
    if (type === "number") {
      const preview = `${prefix}${
        thousandsSeparator
          ? (8888.88).toLocaleString("en-US", {
              minimumFractionDigits: precision,
              maximumFractionDigits: precision,
            })
          : (8888.88).toFixed(precision)
      }${suffix}`;
      return (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>数字格式</Text>
          <div style={{ marginTop: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>精确度</Text>
            <Select
              value={precision}
              onChange={setPrecision}
              options={precisionOptions}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>千分位</Text>
            <Switch
              size="small"
              checked={thousandsSeparator}
              onChange={setThousandsSeparator}
            />
          </div>
          <Space style={{ width: "100%", marginTop: 12 }}>
            <Input
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="前缀"
            />
            <Input
              value={suffix}
              onChange={(event) => setSuffix(event.target.value)}
              placeholder="后缀"
            />
          </Space>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#F9FAFB" }}>
            <Text strong>{preview}</Text>
          </div>
        </div>
      );
    }
    if (type === "autoNumber") {
      const digits = Math.max(1, Math.min(12, Math.trunc(autoNumberDigits || 3)));
      const preview = `${prefix.trim()}${String(
        Math.max(1, Math.trunc(autoNumberStart || 1)),
      ).padStart(digits, "0")}`;
      return (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>编号格式</Text>
          <div style={{ marginTop: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>前缀</Text>
            <Input
              value={prefix}
              maxLength={64}
              placeholder="例如 TASK-"
              onChange={(event) => setPrefix(event.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>数字位数</Text>
            <Select
              value={autoNumberDigits}
              onChange={setAutoNumberDigits}
              style={{ width: "100%", marginTop: 6 }}
              options={Array.from({ length: 12 }, (_, index) => ({
                value: index + 1,
                label: `${index + 1} 位`,
              }))}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              起始值
            </Text>
            <Input
              type="number"
              min={1}
              disabled={mode === "edit" && String(field?.type) === "autoNumber"}
              value={autoNumberStart}
              onChange={(event) =>
                setAutoNumberStart(Math.max(1, Number(event.target.value) || 1))
              }
              placeholder={t("fields.valuePlaceholder")}
              style={{ marginTop: 6 }}
            />
            {mode === "edit" && String(field?.type) === "autoNumber" && (
              <Text
                type="secondary"
                style={{ display: "block", marginTop: 5, fontSize: 11 }}
              >
                已创建的自动编号不会因修改显示格式而重新编号。
              </Text>
            )}
          </div>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: "#F9FAFB",
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>预览</Text>
            <div style={{ marginTop: 4 }}>
              <Text strong>{preview}</Text>
            </div>
          </div>
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="只读稳定编号"
            description="新增记录时由服务端分配下一个序号；删除记录不会回收编号，排序和分组也不会改变历史编号。"
          />
        </div>
      );
    }
    if (type === "rating" || type === "progress") {
      return (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {type === "rating" ? "评分上限" : "进度上限"}
          </Text>
          <Input
            type="number"
            min={1}
            value={maxValue}
            onChange={(event) => setMaxValue(Number(event.target.value) || 0)}
            placeholder={t("fields.valuePlaceholder")}
            style={{ marginTop: 8 }}
          />
        </div>
      );
    }
    return (
      <div style={{ marginTop: 18, padding: 14, borderRadius: 9, background: "#F9FAFB" }}>
        <Text type="secondary">该字段类型无需额外配置。</Text>
      </div>
    );
  };

  const advancedInvalid =
    (type === "formula" && !formulaCheck.valid) ||
    (type === "relation" && !relationTargetTableId);

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: 1,
        height: 1,
        zIndex: 1000,
      }}
    >
      <Popover
        open={open}
        placement="bottomLeft"
        trigger="click"
        onOpenChange={(next) => {
          if (!next && !saving) onClose();
        }}
        content={
          <div
            style={{ width: 660 }}
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: 600 }}>
                {mode === "edit" ? "编辑字段" : "新增字段"}
              </Text>
              <Button
                type="text"
                icon={<CloseOutlined />}
                disabled={saving}
                onClick={onClose}
              />
            </div>
            <div style={{ display: "flex", gap: 18 }}>
              <div
                style={{
                  width: 238,
                  padding: 12,
                  borderRadius: 12,
                  background: "#F9FAFB",
                  border: "1px solid #EEF2F7",
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>字段类型</Text>
                <div style={{ marginTop: 9 }}>{renderTypeSelector()}</div>
                <div style={{ marginTop: 15 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>字段名</Text>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("fields.namePlaceholder")}
                    style={{ marginTop: 7 }}
                  />
                </div>
                {type === "formula" && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 14 }}
                    message="只读派生字段"
                    description="修改被引用字段后，公式值由服务端重新计算。"
                  />
                )}
                {type === "relation" && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 14 }}
                    message="跨表关联字段"
                    description="目标表必须位于当前工作区，并且当前用户需要具备读取权限。"
                  />
                )}
                {type === "autoNumber" && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 14 }}
                    message="只读编号字段"
                    description="序号由服务端分配，用户不能直接修改单元格值。"
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #EEF2F7",
                    maxHeight: "64vh",
                    overflowY: "auto",
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>字段配置</Text>
                  {renderConfigSection()}
                </div>
              </div>
            </div>
            <Divider style={{ margin: "16px 0 12px" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button disabled={saving} onClick={onClose}>取消</Button>
              <Button
                type="primary"
                loading={saving}
                disabled={advancedInvalid}
                onClick={handleSubmit}
              >
                {mode === "edit" ? "保存" : "创建字段"}
              </Button>
            </div>
          </div>
        }
      >
        <span style={{ display: "block", width: 1, height: 1 }} />
      </Popover>
    </div>
  );
}
