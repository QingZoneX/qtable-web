import { useEffect, useMemo, useState } from "react";
import type { Field, TableRecord } from "../../../store/useSmartTableStore";
import { resolveRelationOptions } from "./relationApi";
import { isRelationField, normalizeRelationIds } from "./relationTypes";

export type RelationLabelMap = Record<string, Record<string, string>>;

type RelationRequest = {
  fieldId: string;
  recordIds: string[];
};

export function useRelationLabels(
  tableId: string | null | undefined,
  fields: Field[],
  records: TableRecord[],
): RelationLabelMap {
  const requests = useMemo<RelationRequest[]>(() => {
    return fields.filter(isRelationField).map((field) => {
      const ids = new Set<string>();
      records.forEach((record) => {
        normalizeRelationIds(record[field.id]).forEach((id) => ids.add(id));
      });
      return { fieldId: field.id, recordIds: Array.from(ids) };
    });
  }, [fields, records]);

  const signature = useMemo(
    () =>
      JSON.stringify(
        requests.map((request) => [request.fieldId, request.recordIds]),
      ),
    [requests],
  );
  const [labels, setLabels] = useState<RelationLabelMap>({});

  useEffect(() => {
    if (!tableId) {
      setLabels({});
      return;
    }
    let active = true;
    const load = async () => {
      const next: RelationLabelMap = {};
      await Promise.all(
        requests.map(async (request) => {
          if (request.recordIds.length === 0) {
            next[request.fieldId] = {};
            return;
          }
          try {
            const resolved = await resolveRelationOptions({
              tableId,
              fieldId: request.fieldId,
              recordIds: request.recordIds,
            });
            next[request.fieldId] = Object.fromEntries(
              resolved.map((item) => [item.id, item.title]),
            );
          } catch {
            next[request.fieldId] = {};
          }
        }),
      );
      if (active) setLabels(next);
    };
    void load();
    return () => {
      active = false;
    };
    // signature captures record-id changes without making the effect depend on
    // newly allocated request arrays on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, tableId]);

  return labels;
}
