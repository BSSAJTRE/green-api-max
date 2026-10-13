import { z } from 'zod';

export const ID_INSTANCE_MAX_LENGTH = 12;
export const API_TOKEN_INSTANCE_MAX_LENGTH = 100;

export const loginSchema = z.object({
  idInstance: z
    .string()
    .trim()
    .min(1, 'Введите idInstance')
    .regex(/^\d*$/, 'idInstance должен содержать только цифры')
    .max(ID_INSTANCE_MAX_LENGTH, `idInstance должен быть не длиннее ${ID_INSTANCE_MAX_LENGTH} цифр`),
  apiTokenInstance: z
    .string()
    .trim()
    .min(1, 'Введите apiTokenInstance')
    .max(
      API_TOKEN_INSTANCE_MAX_LENGTH,
      `apiTokenInstance должен быть не длиннее ${API_TOKEN_INSTANCE_MAX_LENGTH} символов`,
    ),
});

export type LoginFormValues = z.input<typeof loginSchema>;
export type LoginFieldErrors = Partial<Record<keyof LoginFormValues, string>>;

export function validateLoginForm(values: LoginFormValues) {
  const result = loginSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} as LoginFieldErrors };

  const { fieldErrors } = z.flattenError(result.error);
  const errors: LoginFieldErrors = {
    idInstance: fieldErrors.idInstance?.[0],
    apiTokenInstance: fieldErrors.apiTokenInstance?.[0],
  };
  return { data: null, errors };
}
