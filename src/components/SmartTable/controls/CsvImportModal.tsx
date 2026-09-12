import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Select,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
  type UploadProps,
} from "antd";
import {
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { client } from "../../../lib/apollo";
import {
  IMPORT_CSV,
  PREVIEW_CSV_IMPORT,
} from "../../../lib/graphql";
import {
  permissionAllows,
  useSmartTableStore,
  type Field,
} from "../../../store/useSmartTableStore";

const { Text, Title } = Typography;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type EncodingOption = "auto" | "utf-8" | "gb18030";

type CsvColumn = {
  index: number;
  name: string;
};

type CsvImportErrorItem = {
  rowNumber: number;
  columnIndex: number;
  columnName: string;
  fieldId: string;
  fieldName: string;
  value: unknown;
  message: string;
};

type CsvPreview = {
  columns: CsvColumn[];
  rowCount: number;
  sampleRows: string[][];
  detectedDelimiter: string;
  warnings: string[];
  hasHeader: boolean;
  validRowCount: number;
  invalidRowCount: number;
  errorCount: number;
  errors: CsvImportErrorItem[];
};

type CsvImportResult = CsvPreview & {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  totalRows: number;
};

type CsvMapping = Record<number, string | undefined>;

type Props = {
  open: boolean;
  onClose: () => void;
};

const SUPPORTED_FIELD_TYPES = new Set([
  "text",
  "number",
  "select",
  "multiSelect",
  "date",
  "progress",
  "url",
  "rating",
  "email",
  "phone",
]);

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "文本",
  number: "数字",
  select: "单选",
  multiSelect: "多选",
  date: "日期",
  progress: "进度",
  url: "链接",
  rating: "评分",
  email: "邮箱",
  phone: "电话",
};

const DELIMITER_LABELS: Record<string, string> = {
  ",": "逗号 ,",
  "\t": "Tab",
  ";": "分号 ;",
  "|": "竖线 |",
};

const normalizeMatchKey = (value: string) => value.trim().toLocaleLowerCase();

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      graphQLErrors?: Array<{ message?: string }>;
    };
    const graphMessage = candidate.graphQLErrors?.[0]?.message;
    if (graphMessage) return graphMessage;
    if (candidate.message) return candidate.message;
  }
  return fallback;
};

const decodeCsvBuffer = (
  buffer: ArrayBuffer,
  encoding: EncodingOption,
): string => {
  const bytes = new Uint8Array(buffer);

  const decode = (label: string, fatal = false) =>
    new TextDecoder(label, { fatal }).decode(bytes);

  if (encoding === "utf-8") return decode("utf-8");
  if (encoding === "gb18030") return decode("gb18030");

  try {
    return decode("utf-8", true);
  } catch {
    try {
      return decode("gb18030");
    } catch {
      throw new Error("无法识别文件编码，请手动选择 UTF-8 或 GB18030");
    }
  }
};

const getSupportedFields = (fields: Field[]) =>
  fields.filter((field) => SUPPORTED_FIELD_TYPES.has(String(field.type)));

const buildAutoMapping = (
  columns: CsvColumn[],
  fields: Field[],
): CsvMapping => {
  const supported = getSupportedFields(fields);
  const used = new Set<string>();
  const mapping: CsvMapping = {};

  columns.forEach((column) => {
    const sourceKey = normalizeMatchKey(column.name);
    const matched = supported.find((field) => {
      if (used.has(field.id)) return false;
      return (
        normalizeMatchKey(field.name) === sourceKey ||
        normalizeMatchKey(field.id) === sourceKey
      );
    });
    if (matched) {
      mapping[column.index] = matched.id;
      used.add(matched.id);
    }
  });

  return mapping;
};

const mappingPayload = (mapping: CsvMapping) =>
  Object.entries(mapping)
    .filter(([, fieldId]) => Boolean(fieldId))
    .map(([sourceIndex, fieldId]) => ({
      sourceIndex: Number(sourceIndex),
      fieldId: fieldId as string,
    }));

export function CsvImportModal({ open, onClose }: Props) {
  const { fields, currentTableId, currentPermission } = useSmartTableStore();
  const canUpdate = permissionAllows(currentPermission, "update");
  const supportedFields = useMemo(() => getSupportedFields(fields), [fields]);

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [csvText, setCsvText] = useState("");
  const [encoding, setEncoding] = useState<EncodingOption>("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState("auto");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [validation, setValidation] = useState<CsvPreview | null>(null);
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep(0);
    setFileName("");
    setFileBuffer(null);
    setCsvText("");
    setEncoding("auto");
    setHasHeader(true);
    setDelimiter("auto");
    setPreview(null);
    setMapping({});
    setValidation(null);
    setSkipInvalidRows(false);
    setLoadingPreview(false);
    setImporting(false);
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const requestPreview = async (
    text: string,
    nextHasHeader: boolean,
    nextDelimiter: string,
    nextMapping?: CsvMapping,
  ) => {
    setLoadingPreview(true);
    try {
      const payload = nextMapping
        ? mappingPayload(nextMapping)
        : undefined;
      const response = await client.mutate({
        mutation: PREVIEW_CSV_IMPORT,
        variables: {
          csvText: text,
          tableId: currentTableId ?? undefined,
          mapping: payload,
          hasHeader: nextHasHeader,
          delimiter: nextDelimiter,
        },
      });
      const next = (
        response as { data?: { previewCsvImport?: CsvPreview } }
      ).data?.previewCsvImport;
      if (!next) throw new Error("CSV 预览返回为空");
      return next;
    } finally {
      setLoadingPreview(false);
    }
  };

  const reparse = async (
    buffer: ArrayBuffer,
    nextEncoding: EncodingOption,
    nextHasHeader: boolean,
    nextDelimiter: string,
  ) => {
    const text = decodeCsvBuffer(buffer, nextEncoding);
    setCsvText(text);
    const nextPreview = await requestPreview(
      text,
      nextHasHeader,
      nextDelimiter,
    );
    setPreview(nextPreview);
    setValidation(null);
    setMapping(buildAutoMapping(nextPreview.columns, fields));
    return nextPreview;
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      message.error("CSV 文件不能超过 5 MB");
      return;
    }
    if (file.size === 0) {
      message.error("CSV 文件为空");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      setFileName(file.name);
      setFileBuffer(buffer);
      await reparse(buffer, encoding, hasHeader, delimiter);
    } catch (error) {
      setPreview(null);
      setMapping({});
      message.error(errorMessage(error, "CSV 文件解析失败"));
    }
  };

  const uploadProps: UploadProps = {
    accept: ".csv,text/csv,text/plain",
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      void handleFile(file as File);
      return false;
    },
  };

  const handleEncodingChange = async (next: EncodingOption) => {
    setEncoding(next);
    if (!fileBuffer) return;
    try {
      await reparse(fileBuffer, next, hasHeader, delimiter);
    } catch (error) {
      message.error(errorMessage(error, "切换编码后解析失败"));
    }
  };

  const handleHeaderChange = async (next: boolean) => {
    setHasHeader(next);
    if (!fileBuffer) return;
    try {
      await reparse(fileBuffer, encoding, next, delimiter);
    } catch (error) {
      message.error(errorMessage(error, "重新解析 CSV 失败"));
    }
  };

  const handleDelimiterChange = async (next: string) => {
    setDelimiter(next);
    if (!fileBuffer) return;
    try {
      await reparse(fileBuffer, encoding, hasHeader, next);
    } catch (error) {
      message.error(errorMessage(error, "重新解析 CSV 失败"));
    }
  };

  const usedFieldIds = useMemo(
    () =>
      new Set(
        Object.values(mapping).filter(
          (fieldId): fieldId is string => Boolean(fieldId),
        ),
      ),
    [mapping],
  );

  const validateMapping = async () => {
    const payload = mappingPayload(mapping);
    if (!csvText || !preview) {
      message.warning("请先选择 CSV 文件");
      return;
    }
    if (!payload.length) {
      message.warning("请至少映射一个 CSV 列");
      return;
    }

    try {
      const next = await requestPreview(
        csvText,
        hasHeader,
        delimiter,
        mapping,
      );
      setValidation(next);
      setStep(2);
    } catch (error) {
      message.error(errorMessage(error, "CSV 数据校验失败"));
    }
  };

  const handleImport = async () => {
    if (!canUpdate) return;
    const payload = mappingPayload(mapping);
    if (!payload.length || !csvText || !validation) return;
    if (
      validation.errorCount > 0 &&
      !skipInvalidRows
    ) {
      message.warning("当前存在错误行，请修正 CSV 或选择“跳过错误行”");
      return;
    }
    if (validation.validRowCount <= 0) {
      message.warning("没有可导入的有效记录");
      return;
    }

    setImporting(true);
    try {
      const response = await client.mutate({
        mutation: IMPORT_CSV,
        variables: {
          csvText,
          mapping: payload,
          tableId: currentTableId ?? undefined,
          hasHeader,
          delimiter,
          skipInvalidRows,
        },
      });
      const result = (
        response as { data?: { importCsv?: CsvImportResult } }
      ).data?.importCsv;
      if (!result) throw new Error("CSV 导入返回为空");

      if (!result.success) {
        setValidation(result);
        message.error(
          result.errorCount
            ? "CSV 中仍存在错误，未写入任何记录"
            : "CSV 导入失败",
        );
        return;
      }

      await client.refetchQueries({ include: ["GetTableData"] });
      message.success(
        result.skippedCount > 0
          ? `已导入 ${result.importedCount} 条，跳过 ${result.skippedCount} 条错误记录`
          : `已成功导入 ${result.importedCount} 条记录`,
      );
      close();
    } catch (error) {
      message.error(errorMessage(error, "CSV 导入失败"));
    } finally {
      setImporting(false);
    }
  };

  const sampleValue = (columnIndex: number) => {
    const values =
      preview?.sampleRows
        ?.map((row) => row[columnIndex]?.trim())
        .filter(Boolean)
        .slice(0, 3) || [];
    return values.join(" / ") || "（空）";
  };

  const footer = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        {step > 0 ? (
          <Button
            disabled={importing || loadingPreview}
            onClick={() => setStep(step - 1)}
          >
            上一步
          </Button>
        ) : null}
      </div>
      <Space>
        <Button disabled={importing} onClick={close}>
          取消
        </Button>
        {step === 0 ? (
          <Button
            type="primary"
            disabled={!preview || loadingPreview}
            onClick={() => setStep(1)}
          >
            下一步：字段映射
          </Button>
        ) : null}
        {step === 1 ? (
          <Button
            type="primary"
            loading={loadingPreview}
            onClick={() => void validateMapping()}
          >
            下一步：校验数据
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            type="primary"
            loading={importing}
            disabled={
              !canUpdate ||
              !validation ||
              validation.validRowCount <= 0 ||
              (validation.errorCount > 0 && !skipInvalidRows)
            }
            onClick={() => void handleImport()}
          >
            导入 {validation?.validRowCount || 0} 条记录
          </Button>
        ) : null}
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      title="导入 CSV"
      width={920}
      footer={footer}
      onCancel={close}
      maskClosable={!importing}
      keyboard={!importing}
      destroyOnHidden
    >
      <Steps
        current={step}
        size="small"
        style={{ margin: "8px 0 24px" }}
        items={[
          { title: "选择文件" },
          { title: "字段映射" },
          { title: "校验并导入" },
        ]}
      />

      {step === 0 ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Upload.Dragger {...uploadProps} disabled={loadingPreview}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">拖拽 CSV 到这里，或点击选择文件</p>
            <p className="ant-upload-hint">
              最大 5 MB、10,000 条数据；支持 UTF-8 和 GB18030
            </p>
          </Upload.Dragger>

          {fileName ? (
            <div
              style={{
                border: "1px solid #EAECF0",
                borderRadius: 8,
                padding: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FileTextOutlined style={{ fontSize: 22, color: "#2563EB" }} />
              <div style={{ flex: 1 }}>
                <Text strong>{fileName}</Text>
                {preview ? (
                  <div style={{ marginTop: 3 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {preview.rowCount} 条数据 · {preview.columns.length} 列 ·
                      分隔符{" "}
                      {DELIMITER_LABELS[preview.detectedDelimiter] ||
                        preview.detectedDelimiter}
                    </Text>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <Text strong style={{ fontSize: 12 }}>
                文件编码
              </Text>
              <Select
                value={encoding}
                style={{ width: "100%", marginTop: 6 }}
                onChange={(value: EncodingOption) =>
                  void handleEncodingChange(value)
                }
                options={[
                  { value: "auto", label: "自动识别" },
                  { value: "utf-8", label: "UTF-8" },
                  { value: "gb18030", label: "GB18030 / GBK" },
                ]}
              />
            </div>
            <div>
              <Text strong style={{ fontSize: 12 }}>
                分隔符
              </Text>
              <Select
                value={delimiter}
                style={{ width: "100%", marginTop: 6 }}
                onChange={(value) => void handleDelimiterChange(value)}
                options={[
                  { value: "auto", label: "自动识别" },
                  { value: ",", label: "逗号 ," },
                  { value: "\t", label: "Tab" },
                  { value: ";", label: "分号 ;" },
                  { value: "|", label: "竖线 |" },
                ]}
              />
            </div>
            <div>
              <Text strong style={{ fontSize: 12 }}>
                第一行是表头
              </Text>
              <div style={{ marginTop: 9 }}>
                <Switch
                  checked={hasHeader}
                  onChange={(value) => void handleHeaderChange(value)}
                />
              </div>
            </div>
          </div>

          {preview?.warnings?.length ? (
            <Alert
              type="warning"
              showIcon
              message="CSV 行结构不完全一致"
              description={
                <div>
                  {preview.warnings.slice(0, 3).map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              }
            />
          ) : null}

          {preview ? (
            <div>
              <Title level={5} style={{ fontSize: 13, marginBottom: 8 }}>
                数据预览（前 {Math.min(10, preview.rowCount)} 条）
              </Title>
              <div
                style={{
                  maxWidth: "100%",
                  overflowX: "auto",
                  border: "1px solid #EAECF0",
                  borderRadius: 8,
                }}
              >
                <table
                  style={{
                    borderCollapse: "collapse",
                    minWidth: "100%",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {preview.columns.map((column) => (
                        <th
                          key={column.index}
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            borderBottom: "1px solid #EAECF0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {preview.columns.map((column) => (
                          <td
                            key={column.index}
                            style={{
                              padding: "7px 10px",
                              borderBottom: "1px solid #F2F4F7",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={row[column.index] || ""}
                          >
                            {row[column.index] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Space>
      ) : null}

      {step === 1 && preview ? (
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          {supportedFields.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="当前数据表没有可导入字段"
              description="CSV 暂不支持直接写入自动编号、公式、关联、成员、图片和附件字段。请先添加文本、数字、日期、选择等普通字段。"
            />
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <Text strong>CSV 列 → QTable 字段</Text>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已自动按字段名匹配；未映射列不会导入。
                </Text>
              </div>
            </div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                setMapping(buildAutoMapping(preview.columns, fields))
              }
            >
              重新自动匹配
            </Button>
          </div>

          <div
            style={{
              border: "1px solid #EAECF0",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {preview.columns.map((column, index) => {
              const selectedFieldId = mapping[column.index];
              return (
                <div
                  key={column.index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(180px, 1fr) 32px minmax(220px, 1fr)",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderTop: index ? "1px solid #F2F4F7" : "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {column.name}
                    </Text>
                    <div
                      style={{
                        marginTop: 3,
                        color: "#98A2B3",
                        fontSize: 11,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={sampleValue(column.index)}
                    >
                      示例：{sampleValue(column.index)}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", color: "#98A2B3" }}>→</div>
                  <Select
                    allowClear
                    placeholder="忽略此列"
                    value={selectedFieldId}
                    style={{ width: "100%" }}
                    onChange={(fieldId) => {
                      setMapping((current) => ({
                        ...current,
                        [column.index]: fieldId || undefined,
                      }));
                      setValidation(null);
                    }}
                    options={supportedFields.map((field) => ({
                      value: field.id,
                      label: `${field.name} · ${
                        FIELD_TYPE_LABELS[String(field.type)] || field.type
                      }`,
                      disabled:
                        usedFieldIds.has(field.id) &&
                        field.id !== selectedFieldId,
                    }))}
                  />
                </div>
              );
            })}
          </div>

          <Alert
            type="info"
            showIcon
            message="类型转换规则"
            description="数字、日期、单选和多选会在写入前由后端统一转换和校验；单选/多选既支持 option ID，也支持界面显示名称。"
          />
        </Space>
      ) : null}

      {step === 2 && validation ? (
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Tag color="blue">总数据 {validation.rowCount}</Tag>
            <Tag color="green">有效 {validation.validRowCount}</Tag>
            <Tag color={validation.invalidRowCount ? "red" : "default"}>
              错误行 {validation.invalidRowCount}
            </Tag>
            <Tag color={validation.errorCount ? "red" : "default"}>
              错误项 {validation.errorCount}
            </Tag>
          </div>

          {validation.errorCount === 0 ? (
            <Alert
              type="success"
              showIcon
              message="校验通过"
              description="所有映射字段都可以正确转换。点击导入后将一次性写入当前数据表。"
            />
          ) : (
            <Alert
              type="error"
              showIcon
              message="发现数据错误"
              description="默认不会写入任何记录。建议返回修改 CSV；如果确认只需要有效数据，可开启“跳过错误行”。"
            />
          )}

          {validation.errorCount > 0 ? (
            <>
              <Checkbox
                checked={skipInvalidRows}
                onChange={(event) =>
                  setSkipInvalidRows(event.target.checked)
                }
              >
                跳过错误行，仅导入 {validation.validRowCount} 条有效记录
              </Checkbox>

              <div
                style={{
                  maxHeight: 320,
                  overflow: "auto",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#FEF2F2" }}>
                      {["行", "CSV 列", "目标字段", "原值", "错误"].map(
                        (label) => (
                          <th
                            key={label}
                            style={{
                              padding: "8px 10px",
                              textAlign: "left",
                              position: "sticky",
                              top: 0,
                              background: "#FEF2F2",
                              borderBottom: "1px solid #FECACA",
                            }}
                          >
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {validation.errors.map((item, index) => (
                      <tr key={`${item.rowNumber}-${item.columnIndex}-${index}`}>
                        <td style={{ padding: "7px 10px" }}>
                          {item.rowNumber}
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          {item.columnName}
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          {item.fieldName}
                        </td>
                        <td
                          style={{
                            padding: "7px 10px",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={String(item.value ?? "")}
                        >
                          {String(item.value ?? "") || "（空）"}
                        </td>
                        <td style={{ padding: "7px 10px", color: "#B42318" }}>
                          {item.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validation.errorCount > validation.errors.length ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  仅展示前 {validation.errors.length} 个错误，共{" "}
                  {validation.errorCount} 个。
                </Text>
              ) : null}
            </>
          ) : null}
        </Space>
      ) : null}
    </Modal>
  );
}
