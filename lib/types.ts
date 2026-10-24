import { z } from 'zod';

const ElementNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.string(),
    props: z.object({
      style: z.record(z.union([z.string(), z.number()])).optional(),
      containerStyle: z.record(z.union([z.string(), z.number()])).optional(),
      split: z.union([z.boolean(), z.string()]).optional(),
      param: z.string().optional(),
      children: z
        .union([z.string(), z.array(ElementNodeSchema)])
        .optional(),
      src: z.string().optional(),
      alt: z.string().optional(),
      imgWidth: z.union([z.number(), z.string()]).nullable().optional(),
      imgHeight: z.union([z.number(), z.string()]).nullable().optional(),
      x: z.union([z.number(), z.string()]).nullable().optional(),
      y: z.union([z.number(), z.string()]).nullable().optional(),
      color: z.string().optional(),
      width: z.union([z.number(), z.string()]).optional(),
      height: z.union([z.number(), z.string()]).optional(),
    }),
  })
);

const FontSchema = z.object({
  family: z.string(),
  path: z.string(),
  weight: z.number().optional(),
  style: z.enum(['normal', 'italic']).optional(),
});

export const StyleDefSchema = z.object({
  fg: z.number().min(1).max(8).optional(),
  bg: z.number().min(1).max(8).optional(),
  font: z.object({
    name: z.string().optional(),
    size: z.number().optional(),
    weight: z.number().optional(),
  }).optional(),
  orientation: z.number().optional(),
  split: z.boolean().optional(),
});

const ParamDefSchema = z.object({
  description: z.string().default(''),
  required: z.boolean().default(false),
  default: z.union([z.string(), z.number()]).default(''),
  type: z.enum(['text', 'textarea', 'boolean', 'color', 'url', 'number']).default('text'),
  group: z.string().optional(),
  style: StyleDefSchema.optional(),
});

export const SlideTemplateSchema = z.object({
  version: z.literal('1'),
  name: z.string(),
  description: z.string().default(''),
  output: z.object({ width: z.number(), height: z.number() }),
  fonts: z.array(FontSchema).default([]),
  params: z.record(ParamDefSchema).default({}),
  palette: z.array(z.string()).max(8).default([]),
  defaults: StyleDefSchema.optional(),
  element: ElementNodeSchema,
});

export type SlideTemplate = z.infer<typeof SlideTemplateSchema>;
export type ElementNode = z.infer<typeof ElementNodeSchema>;
export type FontDef = z.infer<typeof FontSchema>;
export type ParamDef = z.infer<typeof ParamDefSchema>;
export type StyleDef = z.infer<typeof StyleDefSchema>;

export interface TemplateInfo {
  name: string;
  description: string;
  params: Record<string, ParamDef>;
  palette: string[];
  defaults?: StyleDef;
  output: { width: number; height: number };
}
