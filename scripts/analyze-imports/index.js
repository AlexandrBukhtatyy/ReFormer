#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively find all .ts and .tsx files in a directory
 */
function findTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and other common directories
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
        findTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Parse imported entities from import statement
 */
function parseImportedEntities(statement) {
  const entities = [];

  // Side-effect import: import 'module'
  if (/^import\s+['"]/.test(statement)) {
    return entities;
  }

  // Default import: import Foo from 'module'
  const defaultMatch = statement.match(/import\s+(?:type\s+)?(\w+)\s+from/);
  if (defaultMatch && !statement.includes('{') && !statement.includes('*')) {
    entities.push({ name: defaultMatch[1], type: 'default' });
  }

  // Named imports: import { foo, bar } from 'module'
  const namedMatch = statement.match(/\{([^}]+)\}/);
  if (namedMatch) {
    const namedImports = namedMatch[1]
      .split(',')
      .map((item) => {
        // Handle "as" alias: import { foo as bar }
        const parts = item.trim().split(/\s+as\s+/);
        return parts[0].replace(/^type\s+/, '').trim();
      })
      .filter(Boolean);

    namedImports.forEach((name) => {
      entities.push({ name, type: 'named' });
    });
  }

  // Namespace import: import * as Foo from 'module'
  const namespaceMatch = statement.match(/import\s+\*\s+as\s+(\w+)/);
  if (namespaceMatch) {
    entities.push({ name: namespaceMatch[1], type: 'namespace' });
  }

  return entities;
}

/**
 * Extract import statements from file content
 */
function extractImports(content, filePath) {
  const imports = [];

  // Match various import patterns:
  // import foo from 'module'
  // import { foo, bar } from 'module'
  // import * as foo from 'module'
  // import 'module'
  // import type { Foo } from 'module'
  const importRegex = /import\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const fullMatch = match[0];

    // Get line number
    const lineNumber = content.substring(0, match.index).split('\n').length;

    // Parse imported entities
    const entities = parseImportedEntities(fullMatch);

    imports.push({
      statement: fullMatch.trim(),
      module: importPath,
      line: lineNumber,
      file: filePath,
      entities: entities,
    });
  }

  return imports;
}

/**
 * Categorize imports by type
 */
function categorizeImports(imports) {
  const categorized = {
    external: [], // node_modules
    internal: [], // relative imports
    absolute: [], // absolute imports from project
  };

  imports.forEach((imp) => {
    if (imp.module.startsWith('.')) {
      categorized.internal.push(imp);
    } else if (imp.module.startsWith('@') || !imp.module.includes('/')) {
      categorized.external.push(imp);
    } else {
      categorized.absolute.push(imp);
    }
  });

  return categorized;
}

/**
 * Group imports by module
 */
function groupByModule(imports) {
  const grouped = {};

  imports.forEach((imp) => {
    if (!grouped[imp.module]) {
      grouped[imp.module] = [];
    }
    grouped[imp.module].push(imp);
  });

  return grouped;
}

/**
 * Analyze imported entities from external packages
 */
function analyzeEntities(imports) {
  const entityStats = {};

  imports.forEach((imp) => {
    if (!entityStats[imp.module]) {
      entityStats[imp.module] = {
        count: 0,
        entities: new Set(),
        byType: {
          default: 0,
          named: 0,
          namespace: 0,
          sideEffect: 0,
        },
      };
    }

    entityStats[imp.module].count++;

    if (imp.entities.length === 0) {
      entityStats[imp.module].byType.sideEffect++;
    } else {
      imp.entities.forEach((entity) => {
        entityStats[imp.module].entities.add(entity.name);
        entityStats[imp.module].byType[entity.type]++;
      });
    }
  });

  // Convert Sets to Arrays and sort
  Object.keys(entityStats).forEach((module) => {
    entityStats[module].entities = Array.from(entityStats[module].entities).sort();
  });

  return entityStats;
}

/**
 * Build output string
 */
function buildOutput(
  absolutePath,
  files,
  allImports,
  categorized,
  externalGrouped,
  internalGrouped,
  absoluteGrouped
) {
  let output = [];

  output.push(`\n📁 Analyzing imports in: ${absolutePath}\n`);
  output.push(`Found ${files.length} TypeScript files\n`);
  output.push(`Total imports found: ${allImports.length}\n`);

  output.push('═══════════════════════════════════════════════════════════════');
  output.push('📦 EXTERNAL IMPORTS (from node_modules)');
  output.push('═══════════════════════════════════════════════════════════════\n');

  Object.keys(externalGrouped)
    .sort()
    .forEach((module) => {
      output.push(`\n  ${module} (${externalGrouped[module].length} usage(s))`);
      externalGrouped[module].forEach((imp) => {
        const relativePath = path.relative(absolutePath, imp.file);
        output.push(`    └─ ${relativePath}:${imp.line}`);
      });
    });

  output.push('\n\n═══════════════════════════════════════════════════════════════');
  output.push('🔗 INTERNAL IMPORTS (relative paths)');
  output.push('═══════════════════════════════════════════════════════════════\n');

  Object.keys(internalGrouped)
    .sort()
    .forEach((module) => {
      output.push(`\n  ${module} (${internalGrouped[module].length} usage(s))`);
      internalGrouped[module].forEach((imp) => {
        const relativePath = path.relative(absolutePath, imp.file);
        output.push(`    └─ ${relativePath}:${imp.line}`);
      });
    });

  if (categorized.absolute.length > 0) {
    output.push('\n\n═══════════════════════════════════════════════════════════════');
    output.push('📍 ABSOLUTE IMPORTS (project paths)');
    output.push('═══════════════════════════════════════════════════════════════\n');

    Object.keys(absoluteGrouped)
      .sort()
      .forEach((module) => {
        output.push(`\n  ${module} (${absoluteGrouped[module].length} usage(s))`);
        absoluteGrouped[module].forEach((imp) => {
          const relativePath = path.relative(absolutePath, imp.file);
          output.push(`    └─ ${relativePath}:${imp.line}`);
        });
      });
  }

  // Analyze entities from external packages
  const entityStats = analyzeEntities(categorized.external);

  output.push('\n\n═══════════════════════════════════════════════════════════════');
  output.push('📊 SUMMARY');
  output.push('═══════════════════════════════════════════════════════════════\n');
  output.push(`  Total files analyzed:     ${files.length}`);
  output.push(`  Total imports:            ${allImports.length}`);
  output.push(`  External packages:        ${Object.keys(externalGrouped).length}`);
  output.push(`  Internal imports:         ${categorized.internal.length}`);
  output.push(`  Absolute imports:         ${categorized.absolute.length}`);

  // Summary of external packages with entities
  if (Object.keys(entityStats).length > 0) {
    output.push('\n\n═══════════════════════════════════════════════════════════════');
    output.push('📋 EXTERNAL PACKAGES DETAILS');
    output.push('═══════════════════════════════════════════════════════════════\n');

    const sortedPackages = Object.keys(entityStats).sort();

    sortedPackages.forEach((module) => {
      const stats = entityStats[module];
      const totalEntities = stats.entities.length;

      output.push(`\n  ${module}`);
      output.push(`    Imports count: ${stats.count}`);

      if (totalEntities > 0) {
        output.push(`    Unique entities: ${totalEntities}`);
        output.push(
          `    Import types: default: ${stats.byType.default}, named: ${stats.byType.named}, namespace: ${stats.byType.namespace}`
        );
        output.push(`    Entities: ${stats.entities.join(', ')}`);
      } else if (stats.byType.sideEffect > 0) {
        output.push(`    Side-effect imports: ${stats.byType.sideEffect}`);
      }
    });

    // Summary statistics
    const totalEntitiesCount = sortedPackages.reduce(
      (sum, module) => sum + entityStats[module].entities.length,
      0
    );

    output.push('\n\n─────────────────────────────────────────────────────────────');
    output.push('Summary by import types:');
    output.push('─────────────────────────────────────────────────────────────\n');

    const totalByType = sortedPackages.reduce(
      (acc, module) => {
        acc.default += entityStats[module].byType.default;
        acc.named += entityStats[module].byType.named;
        acc.namespace += entityStats[module].byType.namespace;
        acc.sideEffect += entityStats[module].byType.sideEffect;
        return acc;
      },
      { default: 0, named: 0, namespace: 0, sideEffect: 0 }
    );

    output.push(`  Default imports:     ${totalByType.default}`);
    output.push(`  Named imports:       ${totalByType.named}`);
    output.push(`  Namespace imports:   ${totalByType.namespace}`);
    output.push(`  Side-effect imports: ${totalByType.sideEffect}`);
    output.push(`  Total unique entities: ${totalEntitiesCount}`);
  }

  output.push('\n');

  return output.join('\n');
}

/**
 * Main function
 */
function analyzeImports() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let targetDir = process.cwd();
  let outputFile = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputFile = args[i + 1];
      i++; // skip next argument
    } else if (!args[i].startsWith('-')) {
      targetDir = args[i];
    }
  }

  const absolutePath = path.resolve(targetDir);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: Directory "${absolutePath}" does not exist`);
    process.exit(1);
  }

  // Find all TypeScript files
  const files = findTypeScriptFiles(absolutePath);

  // Extract all imports
  const allImports = [];
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    const imports = extractImports(content, file);
    allImports.push(...imports);
  });

  // Categorize imports
  const categorized = categorizeImports(allImports);

  // Group imports by module
  const externalGrouped = groupByModule(categorized.external);
  const internalGrouped = groupByModule(categorized.internal);
  const absoluteGrouped = groupByModule(categorized.absolute);

  // Build and output the result
  const output = buildOutput(
    absolutePath,
    files,
    allImports,
    categorized,
    externalGrouped,
    internalGrouped,
    absoluteGrouped
  );

  // Write to file or stdout
  if (outputFile) {
    // Write to file with explicit UTF-8 encoding
    fs.writeFileSync(outputFile, output, 'utf-8');
    console.log(`\n✅ Analysis saved to: ${outputFile}`);
  } else {
    // Output to stdout
    process.stdout.write(output);
  }
}

// Run the script
analyzeImports();
