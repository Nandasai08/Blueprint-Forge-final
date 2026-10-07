import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAreaSummaryQueryKey,
  getGetCivicRecordQueryKey,
  getGetCivicRecordsQueryKey,
  useCreateCivicRecord,
  useGetCivicRecords,
  useUpdateCivicRecord,
} from '@workspace/api-client-react';
import type { CivicRecord, CivicRecordInput, CivicResource } from '@workspace/api-client-react';
import { Button } from '@/components/ui-kit';

type FormState = {
  title: string;
  name: string;
  code: string;
  description: string;
  category: string;
  location: string;
  area_id: string;
  priority: string;
  status: string;
  assigned_department: string;
  assigned_officer: string;
  assigned_team: string;
  asset_type: string;
  population: string;
  notes: string;
  waste_level: string;
  collection_status: string;
  condition: string;
  next_collection: string;
  expected_completion: string;
  start_date: string;
  last_inspection: string;
  next_maintenance: string;
};

const defaultStatus = (resource: CivicResource) =>
  resource === 'infrastructure'
    ? 'Operational'
    : resource === 'maintenance'
      ? 'Planned'
      : 'Pending';

function dateValue(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function makeInitialState(resource: CivicResource, record?: CivicRecord): FormState {
  return {
    title: record?.title ?? '',
    name: record?.name ?? '',
    code: record?.code ?? '',
    description: record?.description ?? '',
    category: record?.category ?? '',
    location: record?.location ?? '',
    area_id: record?.area_id ?? '',
    priority: record?.priority ?? 'Medium',
    status: record?.status ?? defaultStatus(resource),
    assigned_department: record?.assigned_department ?? '',
    assigned_officer: record?.assigned_officer ?? '',
    assigned_team: record?.assigned_team ?? '',
    asset_type: record?.asset_type ?? '',
    population: record?.population == null ? '' : String(record.population),
    notes: record?.notes ?? '',
    waste_level: record?.waste_level ?? 'Low',
    collection_status: record?.collection_status ?? 'Scheduled',
    condition: record?.condition ?? (resource === 'sanitation' ? 'Clean' : 'Good'),
    next_collection: record?.next_collection ?? '',
    expected_completion: dateValue(record?.expected_completion),
    start_date: dateValue(record?.start_date),
    last_inspection: dateValue(record?.last_inspection),
    next_maintenance: dateValue(record?.next_maintenance),
  };
}

export function ResourceForm({
  resource,
  close,
  initial,
}: {
  resource: CivicResource;
  close: () => void;
  initial?: CivicRecord;
}) {
  const client = useQueryClient();
  const create = useCreateCivicRecord();
  const update = useUpdateCivicRecord();
  const areas = useGetCivicRecords('areas', {
    page: 1,
    page_size: 100,
    sort: 'name',
    direction: 'asc',
  });
  const [form, setForm] = useState(() => makeInitialState(resource, initial));
  const busy = create.isPending || update.isPending;
  const changing = initial !== undefined;
  const setField = (field: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const fields: (keyof FormState)[] =
    resource === 'areas'
      ? ['name', 'code', 'population', 'description']
      : resource === 'infrastructure'
        ? [
            'name',
            'asset_type',
            'location',
            'area_id',
            'condition',
            'status',
            'assigned_department',
            'last_inspection',
            'next_maintenance',
            'description',
            'notes',
          ]
        : resource === 'sanitation'
          ? [
              'location',
              'area_id',
              'waste_level',
              'collection_status',
              'condition',
              'next_collection',
              'assigned_team',
              'notes',
            ]
          : resource === 'maintenance'
            ? [
                'title',
                'category',
                'location',
                'area_id',
                'priority',
                'status',
                'assigned_department',
                'assigned_team',
                'start_date',
                'expected_completion',
                'description',
                'notes',
              ]
            : [
                'title',
                'description',
                'category',
                'location',
                'area_id',
                'priority',
                'status',
                'assigned_department',
                'assigned_officer',
                'notes',
              ];

  const choices: Record<string, string[]> = {
    priority: ['Low', 'Medium', 'High', 'Critical'],
    status:
      resource === 'complaints'
        ? ['Pending', 'In Progress', 'Resolved', 'Rejected']
        : resource === 'infrastructure'
          ? ['Operational', 'Needs Maintenance', 'Under Repair', 'Non Operational']
          : ['Planned', 'In Progress', 'Completed', 'Delayed', 'Cancelled'],
    condition:
      resource === 'infrastructure'
        ? ['Good', 'Fair', 'Poor', 'Critical']
        : ['Clean', 'Moderate', 'Needs Attention', 'Critical'],
    waste_level: ['Low', 'Medium', 'High', 'Critical'],
    collection_status: ['Scheduled', 'Collected', 'Delayed', 'Missed'],
    asset_type: ['Road', 'Streetlight', 'Water Pipeline', 'Drainage', 'Public Building', 'Bridge', 'Other'],
    category: ['Roads', 'Streetlights', 'Water Supply', 'Drainage', 'Waste Management', 'Public Safety', 'Other'],
  };
  const required = new Set(
    resource === 'areas'
      ? ['name', 'code']
      : resource === 'infrastructure'
        ? ['name', 'asset_type', 'location', 'area_id']
        : resource === 'sanitation'
          ? ['location', 'area_id']
          : ['title', 'category', 'location', 'area_id'],
  );
  const labels: Record<string, string> = {
    area_id: 'Area',
    asset_type: 'Asset type',
    assigned_department: 'Department',
    assigned_officer: 'Assigned officer',
    assigned_team: 'Assigned team',
    collection_status: 'Collection status',
    expected_completion: 'Expected completion',
    last_inspection: 'Last inspection',
    next_collection: 'Next collection',
    next_maintenance: 'Next maintenance',
    start_date: 'Start date',
    waste_level: 'Waste level',
  };
  const title = resource.slice(0, 1).toUpperCase() + resource.slice(1);

  const onSuccess = () => {
    void client.invalidateQueries({ queryKey: getGetCivicRecordsQueryKey(resource) });
    if (initial) {
      void client.invalidateQueries({
        queryKey: getGetCivicRecordQueryKey(resource, initial.id),
      });
      if (resource === 'areas') {
        void client.invalidateQueries({ queryKey: getGetAreaSummaryQueryKey(initial.id) });
      }
    }
    close();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data: CivicRecordInput = {
      ...form,
      population: form.population === '' ? undefined : Number(form.population),
    };
    if (initial) {
      update.mutate({ resource, id: initial.id, data }, { onSuccess });
    } else {
      create.mutate({ resource, data }, { onSuccess });
    }
  };

  const error = create.error ?? update.error;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation">
      <form
        onSubmit={submit}
        className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-form-title"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id="resource-form-title" className="text-xl font-bold">
              {changing ? `Edit ${title.toLowerCase()} record` : `Add ${title.toLowerCase()} record`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Changes are saved to the municipal operations system.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const label = labels[field] ?? field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
            const wide = ['description', 'notes'].includes(field);
            const isArea = field === 'area_id';
            const options =
              field === 'category' && resource === 'maintenance'
                ? undefined
                : choices[field];
            return (
              <label
                key={field}
                className={`text-xs font-semibold ${wide ? 'sm:col-span-2' : ''}`}
              >
                {label}
                {wide ? (
                  <textarea
                    value={form[field]}
                    onChange={(event) => setField(field, event.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : isArea ? (
                  <select
                    required={required.has(field)}
                    value={form.area_id}
                    onChange={(event) => setField(field, event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select an area</option>
                    {areas.data?.items.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name} · {area.code}
                      </option>
                    ))}
                  </select>
                ) : options ? (
                  <select
                    required={required.has(field)}
                    value={form[field]}
                    onChange={(event) => setField(field, event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={required.has(field)}
                    min={field === 'population' ? 0 : undefined}
                    type={field === 'population' ? 'number' : field === 'expected_completion' || field === 'start_date' || field === 'last_inspection' || field === 'next_maintenance' ? 'date' : 'text'}
                    value={form[field]}
                    onChange={(event) => setField(field, event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </label>
            );
          })}
        </div>
        {areas.isError && fields.includes('area_id') && (
          <p className="mt-3 text-sm text-destructive">The area list could not be loaded.</p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'The record could not be saved.'}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || areas.isLoading || (areas.isError && fields.includes('area_id'))}>
            {changing ? 'Save changes' : 'Create record'}
          </Button>
        </div>
      </form>
    </div>
  );
}
