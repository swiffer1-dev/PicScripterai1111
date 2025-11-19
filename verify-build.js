#!/usr/bin/env node
/**
 * Build verification script
 * Run after build to verify all files are in the correct location
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Verifying build output...\n');

const checks = [
  { path: 'dist/index.js', description: 'Web server bundle' },
  { path: 'dist/worker.js', description: 'Worker bundle' },
  { path: 'dist/public/index.html', description: 'Frontend HTML' },
  { path: 'dist/public/assets', description: 'Frontend assets', isDir: true },
];

let allPassed = true;

checks.forEach(({ path: filePath, description, isDir }) => {
  const fullPath = path.resolve(__dirname, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    if (isDir) {
      const files = fs.readdirSync(fullPath);
      console.log(`✅ ${description}: ${fullPath} (${files.length} files)`);
    } else {
      const stats = fs.statSync(fullPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`✅ ${description}: ${fullPath} (${sizeKB} KB)`);
    }
  } else {
    console.log(`❌ ${description}: ${fullPath} NOT FOUND`);
    allPassed = false;
  }
});

console.log('\n📁 Directory structure:');
console.log('dist/');

function printDir(dir, prefix = '') {
  try {
    const items = fs.readdirSync(dir);
    items.forEach((item, index) => {
      const isLast = index === items.length - 1;
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      const connector = isLast ? '└── ' : '├── ';
      
      if (stats.isDirectory()) {
        console.log(`${prefix}${connector}${item}/`);
        if (item !== 'node_modules' && prefix.length < 20) {
          printDir(itemPath, prefix + (isLast ? '    ' : '│   '));
        }
      } else {
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`${prefix}${connector}${item} (${sizeKB} KB)`);
      }
    });
  } catch (err) {
    console.log(`${prefix}[Error reading directory: ${err.message}]`);
  }
}

const distPath = path.resolve(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  printDir(distPath);
} else {
  console.log('❌ dist/ directory not found!');
  allPassed = false;
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('✅ Build verification PASSED');
  console.log('   Ready to deploy!');
  process.exit(0);
} else {
  console.log('❌ Build verification FAILED');
  console.log('   Fix the issues above before deploying');
  process.exit(1);
}
