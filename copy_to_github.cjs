const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'github');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

const itemsToCopy = [
  'src',
  'electron',
  'public',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'index.html',
  'readme.md',
  'eslint.config.js'
];

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName),
                        path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

itemsToCopy.forEach(item => {
  const srcPath = path.join(srcDir, item);
  const destPath = path.join(destDir, item);
  if (fs.existsSync(srcPath)) {
    copyRecursiveSync(srcPath, destPath);
    console.log('Copied: ' + item);
  }
});

console.log('Packaging to GitHub directory complete.');
