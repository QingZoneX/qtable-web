
export const dateCategoryEnum = {
  EXPIRED: '0',
  TODAY: '1',
  TOMORROW: '2',
  NEXT_SEVEN_DAYS: '3',
  LATER: '4',
  UNSCHEDULED: '5',
};

export const dateCategoryDisplayMap: Record<string, string> = {
  [dateCategoryEnum.EXPIRED]: 'Past',
  [dateCategoryEnum.TODAY]: 'Today',
  [dateCategoryEnum.TOMORROW]: 'Tomorrow',
  [dateCategoryEnum.NEXT_SEVEN_DAYS]: 'Next 7 Days',
  [dateCategoryEnum.LATER]: 'Later',
  [dateCategoryEnum.UNSCHEDULED]: 'Unscheduled',
};

export const getGroupTitle = (
  value: unknown,
  fieldType: string
): string => {
  if (value === undefined || value === null || value === 'UNDEFINED') {
    return 'No Grouping';
  }

  if (fieldType === 'date') {
    const key = String(value);
    return dateCategoryDisplayMap[key] || key;
  }

  if (fieldType === 'member') {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === 'object' && v !== null) {
            const candidate = v as { name?: string; title?: string };
            return candidate.name || candidate.title || String(v);
          }
          return String(v);
        })
        .join(', ');
    }
    if (typeof value === 'object') {
      const candidate = value as { name?: string; title?: string };
      return candidate.name || candidate.title || 'Unknown Member';
    }
    return String(value);
  }

  if (fieldType === 'select' || fieldType === 'multiSelect') {
      if (Array.isArray(value)) {
          return value
            .map((v) => {
              if (typeof v === 'object' && v !== null) {
                const candidate = v as { label?: string; name?: string };
                return candidate.label || candidate.name || String(v);
              }
              return String(v);
            })
            .join(', ');
      }
      if (typeof value === 'object' && value !== null) {
        const candidate = value as { label?: string; name?: string };
        return candidate.label || candidate.name || '';
      }
      return String(value);
  }

  return String(value);
};
