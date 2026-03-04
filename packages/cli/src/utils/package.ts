/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type PackageJson = {
  name?: string;
  version?: string;
  description?: string;
  homepage?: string;
  config?: {
    sandboxImageUri?: string;
  };
  [key: string]: unknown;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let packageJson: PackageJson | undefined;

/**
 * Find and read package.json by traversing up from the current directory.
 * This replaces read-package-up to avoid the url.parse() deprecation warning.
 */
export async function getPackageJson(): Promise<PackageJson | undefined> {
  if (packageJson) {
    return packageJson;
  }

  let currentDir = __dirname;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content) as PackageJson;

      // Verify this is the qwen-code package, not a parent package
      if (pkg.name === '@qwen-code/qwen-code') {
        packageJson = pkg;
        return packageJson;
      }
    } catch {
      // File doesn't exist or isn't valid JSON, continue searching
    }

    currentDir = path.dirname(currentDir);
  }

  return undefined;
}
