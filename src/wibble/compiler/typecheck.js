"use strict";

import { transformAst } from "../common/transform";

/*
 * 1. Attach a new (locals) scope to each block and handler.
 * 2. Attach an unknown-type reference to each local and handler.
 * 3. Catch unresolved references and duplicate names.
 */
export function buildScopes(expr, errors) {
  expr; errors;
}

/*
 * unresolved:
 *   - alias type "@" to the nearest outer "new"
 *   - when a type is explicitly given, verify that it matches our inferred type.
 */
