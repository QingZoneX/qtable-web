import { client } from "../../../lib/apollo";
import { GET_RELATION_OPTIONS } from "./relationGraphql";
import type { RelationOption, RelationOptionsPayload } from "./relationTypes";

const EMPTY_PAYLOAD: RelationOptionsPayload = {
  targetTableId: "",
  displayFieldId: null,
  multiple: true,
  total: 0,
  hasMore: false,
  items: [],
};

const parsePayload = (value: unknown): RelationOptionsPayload => {
  if (!value || typeof value !== "object") return EMPTY_PAYLOAD;
  const raw = value as Partial<RelationOptionsPayload>;
  const items: RelationOption[] = Array.isArray(raw.items)
    ? raw.items
        .filter(
          (item): item is RelationOption =>
            Boolean(
              item &&
                typeof item === "object" &&
                typeof (item as RelationOption).id === "string" &&
                typeof (item as RelationOption).title === "string",
            ),
        )
        .map((item) => ({ id: item.id, title: item.title }))
    : [];
  return {
    targetTableId:
      typeof raw.targetTableId === "string" ? raw.targetTableId : "",
    displayFieldId:
      typeof raw.displayFieldId === "string" ? raw.displayFieldId : null,
    multiple: raw.multiple !== false,
    total: typeof raw.total === "number" ? raw.total : items.length,
    hasMore: Boolean(raw.hasMore),
    items,
  };
};

export async function fetchRelationOptions(args: {
  tableId: string;
  fieldId: string;
  search?: string;
  offset?: number;
  limit?: number;
  recordIds?: string[];
}): Promise<RelationOptionsPayload> {
  const result = await client.query({
    query: GET_RELATION_OPTIONS,
    variables: {
      tableId: args.tableId,
      fieldId: args.fieldId,
      search: args.search || undefined,
      offset: args.offset ?? 0,
      limit: args.limit ?? 50,
      recordIds: args.recordIds,
    },
    fetchPolicy: "network-only",
  });
  return parsePayload(
    (result as { data?: { relationOptions?: unknown } }).data?.relationOptions,
  );
}

export async function resolveRelationOptions(args: {
  tableId: string;
  fieldId: string;
  recordIds: string[];
}): Promise<RelationOption[]> {
  const unique = Array.from(new Set(args.recordIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const result: RelationOption[] = [];
  for (let index = 0; index < unique.length; index += 200) {
    const chunk = unique.slice(index, index + 200);
    const payload = await fetchRelationOptions({
      tableId: args.tableId,
      fieldId: args.fieldId,
      recordIds: chunk,
      limit: 200,
    });
    result.push(...payload.items);
  }
  return result;
}
