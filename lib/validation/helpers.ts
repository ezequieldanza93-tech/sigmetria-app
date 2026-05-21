import { z } from 'zod'

export function validateFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
) {
  const entries: Record<string, unknown> = {}

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key)
    entries[key] = values.length > 1 ? values : values[0]
  }

  return schema.safeParse(entries)
}

export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ')
}
