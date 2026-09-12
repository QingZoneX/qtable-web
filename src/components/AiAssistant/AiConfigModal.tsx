import React, { useEffect, useCallback, useState } from "react";
import { Modal, Form, Input, Select, Button, message, Typography, Space, List, Popconfirm, Empty } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  GET_AI_CONFIGS,
  SAVE_AI_CONFIG,
  DELETE_AI_CONFIG,
} from "../../lib/aiApi";
import { t } from "../../lib/i18nRuntime";

const { Text, Link } = Typography;

interface AiConfigModalProps {
  open: boolean;
  onClose: () => void;
  onConfigSaved?: () => void | Promise<void>;
}

type AiConfigItem = {
  id: string;
  provider: string;
  model: string;
  createdAt?: string;
  updatedAt?: string;
};

type AiConfigsQueryData = {
  aiConfigs: AiConfigItem[];
};

const PROVIDER_OPTIONS = [
  { value: "deepseek", label: "DeepSeek" },
];

const AiConfigModal: React.FC<AiConfigModalProps> = ({
  open,
  onClose,
  onConfigSaved,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data: configsData, refetch: refetchConfigs } = useQuery<AiConfigsQueryData>(GET_AI_CONFIGS, {
    skip: !open,
  });

  const [saveAiConfig] = useMutation(SAVE_AI_CONFIG);
  const [deleteAiConfig] = useMutation(DELETE_AI_CONFIG);

  const configs: AiConfigItem[] = configsData?.aiConfigs ?? [];

  const resetForm = useCallback(() => {
    setEditingId(null);
    setShowKey(false);
    form.resetFields();
    form.setFieldsValue({
      provider: "deepseek",
      model: "deepseek-chat",
    });
  }, [form]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetForm();
    }
  }, [open, resetForm]);

  const handleEdit = (config: AiConfigItem) => {
    setEditingId(config.id);
    form.setFieldsValue({
      provider: config.provider,
      model: config.model,
      apiKey: "", // API Key 不回显
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveAiConfig({
        variables: {
          input: {
            id: editingId || undefined,
            provider: values.provider || "deepseek",
            apiKey: values.apiKey,
            model: values.model || "deepseek-chat",
          },
        },
      });
      message.success(editingId ? "配置已更新" : "配置已保存");
      setSaving(false);
      resetForm();
      await refetchConfigs();
      await onConfigSaved?.();
    } catch (error) {
      setSaving(false);
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAiConfig({
        variables: { id },
      });
      message.success("配置已删除");
      if (editingId === id) {
        resetForm();
      }
      await refetchConfigs();
      await onConfigSaved?.();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      title="AI 模型配置"
      open={open}
      onCancel={handleCancel}
      footer={
        <Space>
          <Button onClick={handleCancel}>关闭</Button>
          {editingId === null && (
            <Button type="primary" loading={saving} onClick={handleSave}>
              添加模型
            </Button>
          )}
          {editingId !== null && (
            <Button type="primary" loading={saving} onClick={handleSave}>
              更新配置
            </Button>
          )}
        </Space>
      }
      width={560}
    >
      {/* 已配置的模型列表 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>已配置的模型</Text>
        {configs.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模型配置" />
        ) : (
          <List
            size="small"
            bordered
            dataSource={configs}
            renderItem={(config) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(config)}
                  />,
                  <Popconfirm
                    title="确定删除该模型配置？"
                    onConfirm={() => handleDelete(config.id)}
                    okText={t("common.delete")}
                    cancelText={t("common.cancel")}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={`${config.provider} - ${config.model}`}
                  description={`ID: ${config.id.slice(0, 8)}...`}
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 添加/编辑表单 */}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
        <Text strong>{editingId ? "编辑模型配置" : "新增模型配置"}</Text>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ provider: "deepseek", model: "deepseek-chat" }}
          style={{ marginTop: 8 }}
        >
          <Form.Item name="provider" label="服务提供方">
            <Select options={PROVIDER_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: "请输入 API Key" }]}
          >
            <Input.Password
              placeholder="sk-..."
              visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
            />
          </Form.Item>
          <Form.Item name="model" label="模型名称">
            <Input placeholder="deepseek-chat" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          获取 API Key：{" "}
          <Link href="https://platform.deepseek.com" target="_blank">
            https://platform.deepseek.com
          </Link>
        </Text>
      </div>
    </Modal>
  );
};

export default AiConfigModal;
