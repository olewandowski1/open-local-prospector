# Use TypeScript AST For Boundaries

Status: resolved

## Acceptance Criteria

- [x] Import, export, and dynamic-import discovery uses a TypeScript-capable parser.
- [x] Type-only imports remain distinguishable from runtime imports.
- [x] Existing and adversarial architecture fixtures pass.

## Answer

Replaced regular-expression dependency discovery with `@babel/parser` configured for TypeScript and
TSX. The AST traversal recognizes static imports, re-exports, dynamic imports, and erased type-only
dependencies. All 14 architecture fixtures, the repository architecture scan, and TypeScript pass.
