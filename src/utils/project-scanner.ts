import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface ProjectInfo {
  name: string;
  description: string;
  type: string;
  mainLanguages: string[];
  structure: string;
  dependencies?: string[];
  scripts?: Record<string, string>;
  entryPoints?: string[];
}

export class ProjectScanner {
  private static cachedInfo: ProjectInfo | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Scan the current working directory to understand the project structure
   */
  static async scan(workingDir: string = process.cwd()): Promise<ProjectInfo> {
    // Return cached info if still valid
    const now = Date.now();
    if (this.cachedInfo && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedInfo;
    }

    logger.info(`Scanning project at: ${workingDir}`);

    const info: ProjectInfo = {
      name: path.basename(workingDir),
      description: '',
      type: 'unknown',
      mainLanguages: [],
      structure: '',
      dependencies: [],
      scripts: {},
      entryPoints: [],
    };

    try {
      // Check for package.json (Node.js/JavaScript/TypeScript project)
      const packageJsonPath = path.join(workingDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        info.name = packageJson.name || info.name;
        info.description = packageJson.description || '';
        info.type = 'node';
        info.mainLanguages = this.detectLanguages(workingDir);
        info.dependencies = Object.keys(packageJson.dependencies || {});
        info.scripts = packageJson.scripts || {};

        if (packageJson.main) info.entryPoints!.push(packageJson.main);
        if (packageJson.bin) {
          if (typeof packageJson.bin === 'string') {
            info.entryPoints!.push(packageJson.bin);
          } else {
            info.entryPoints!.push(...Object.values(packageJson.bin).filter((v): v is string => typeof v === 'string'));
          }
        }
      }

      // Check for Python project
      const requirementsTxt = path.join(workingDir, 'requirements.txt');
      const setupPy = path.join(workingDir, 'setup.py');
      const pyprojectToml = path.join(workingDir, 'pyproject.toml');

      if (fs.existsSync(requirementsTxt) || fs.existsSync(setupPy) || fs.existsSync(pyprojectToml)) {
        info.type = 'python';
        info.mainLanguages = ['Python'];

        if (fs.existsSync(requirementsTxt)) {
          const requirements = fs.readFileSync(requirementsTxt, 'utf-8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .map(line => line.split('==')[0].trim());
          info.dependencies = requirements;
        }
      }

      // Check for Go project
      const goMod = path.join(workingDir, 'go.mod');
      if (fs.existsSync(goMod)) {
        info.type = 'go';
        info.mainLanguages = ['Go'];
      }

      // Check for Rust project
      const cargoToml = path.join(workingDir, 'Cargo.toml');
      if (fs.existsSync(cargoToml)) {
        info.type = 'rust';
        info.mainLanguages = ['Rust'];
      }

      // Check for Java/Maven project
      const pomXml = path.join(workingDir, 'pom.xml');
      if (fs.existsSync(pomXml)) {
        info.type = 'java-maven';
        info.mainLanguages = ['Java'];
      }

      // Check for Gradle project
      const buildGradle = path.join(workingDir, 'build.gradle');
      if (fs.existsSync(buildGradle)) {
        info.type = 'java-gradle';
        info.mainLanguages = ['Java', 'Kotlin'];
      }

      // Get directory structure (top-level directories only)
      info.structure = this.getDirectoryStructure(workingDir);

      // Cache the result
      this.cachedInfo = info;
      this.cacheTimestamp = now;

      logger.info(`Project scan complete: ${info.name} (${info.type})`);

      return info;
    } catch (error: any) {
      logger.error('Error scanning project:', error);
      return info;
    }
  }

  /**
   * Detect programming languages used in the project
   */
  private static detectLanguages(workingDir: string): string[] {
    const languages = new Set<string>();

    try {
      const files = fs.readdirSync(workingDir);

      // Check for config files and common extensions
      if (files.some(f => f === 'tsconfig.json' || f.endsWith('.ts'))) {
        languages.add('TypeScript');
      }
      if (files.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) {
        languages.add('JavaScript');
      }
      if (files.some(f => f.endsWith('.py'))) {
        languages.add('Python');
      }
      if (files.some(f => f.endsWith('.go'))) {
        languages.add('Go');
      }
      if (files.some(f => f.endsWith('.rs'))) {
        languages.add('Rust');
      }
      if (files.some(f => f.endsWith('.java'))) {
        languages.add('Java');
      }
      if (files.some(f => f.endsWith('.kt'))) {
        languages.add('Kotlin');
      }
      if (files.some(f => f.endsWith('.rb'))) {
        languages.add('Ruby');
      }
      if (files.some(f => f.endsWith('.php'))) {
        languages.add('PHP');
      }
      if (files.some(f => f.endsWith('.swift'))) {
        languages.add('Swift');
      }

      // Check subdirectories
      const srcDir = path.join(workingDir, 'src');
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        this.scanDirectoryForLanguages(srcDir, languages);
      }

    } catch (error) {
      logger.debug('Error detecting languages:', error);
    }

    return Array.from(languages);
  }

  private static scanDirectoryForLanguages(dir: string, languages: Set<string>): void {
    try {
      const files = fs.readdirSync(dir);

      for (const file of files.slice(0, 20)) { // Limit to first 20 files for performance
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          if (file.endsWith('.ts') || file.endsWith('.tsx')) languages.add('TypeScript');
          if (file.endsWith('.js') || file.endsWith('.jsx')) languages.add('JavaScript');
          if (file.endsWith('.py')) languages.add('Python');
          if (file.endsWith('.go')) languages.add('Go');
          if (file.endsWith('.rs')) languages.add('Rust');
          if (file.endsWith('.java')) languages.add('Java');
          if (file.endsWith('.kt')) languages.add('Kotlin');
        }
      }
    } catch (error) {
      // Ignore errors in subdirectories
    }
  }

  /**
   * Get a simple directory structure overview
   */
  private static getDirectoryStructure(workingDir: string): string {
    try {
      const entries = fs.readdirSync(workingDir, { withFileTypes: true });
      const dirs = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => e.name)
        .slice(0, 10); // Limit to first 10 directories

      const files = entries
        .filter(e => e.isFile() && !e.name.startsWith('.'))
        .map(e => e.name)
        .slice(0, 10); // Limit to first 10 files

      let structure = '';
      if (dirs.length > 0) {
        structure += `Directories: ${dirs.join(', ')}`;
      }
      if (files.length > 0) {
        if (structure) structure += '\n';
        structure += `Files: ${files.join(', ')}`;
      }

      return structure;
    } catch (error) {
      return 'Unable to read directory structure';
    }
  }

  /**
   * Format project info as a context string for the AI
   */
  static formatAsContext(info: ProjectInfo): string {
    let context = `\n## Current Project Context\n`;
    context += `Project: ${info.name}\n`;

    if (info.description) {
      context += `Description: ${info.description}\n`;
    }

    context += `Type: ${info.type}\n`;

    if (info.mainLanguages.length > 0) {
      context += `Languages: ${info.mainLanguages.join(', ')}\n`;
    }

    if (info.structure) {
      context += `\nStructure:\n${info.structure}\n`;
    }

    if (info.entryPoints && info.entryPoints.length > 0) {
      context += `\nEntry Points: ${info.entryPoints.join(', ')}\n`;
    }

    if (info.dependencies && info.dependencies.length > 0) {
      const depList = info.dependencies.slice(0, 10).join(', ');
      const more = info.dependencies.length > 10 ? ` (and ${info.dependencies.length - 10} more)` : '';
      context += `\nKey Dependencies: ${depList}${more}\n`;
    }

    if (info.scripts && Object.keys(info.scripts).length > 0) {
      context += `\nAvailable Scripts: ${Object.keys(info.scripts).join(', ')}\n`;
    }

    return context;
  }

  /**
   * Clear the cache (useful when project structure changes)
   */
  static clearCache(): void {
    this.cachedInfo = null;
    this.cacheTimestamp = 0;
  }
}
