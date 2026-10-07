import { z } from 'zod';
import { Anchor } from './schema.js';

/**
 * JSON Schema for editor autocompletion. It cannot express every rule (cross-field checks,
 * file-name and date rules), so `pnpm validate:data` remains the authority.
 */
export function anchorJsonSchema(): string {
  const schema = z.toJSONSchema(Anchor, { target: 'draft-2020-12' });
  return JSON.stringify({ title: 'Corridor Finder anchor record', ...schema }, null, 2) + '\n';
}
