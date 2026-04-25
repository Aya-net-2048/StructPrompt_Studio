const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const electronDist = path.join(projectRoot, 'node_modules', 'electron', 'dist');
const releaseDir = path.join(projectRoot, 'release', 'StructPromptStudio');
const appDir = path.join(releaseDir, 'resources', 'app');

console.log('开始封装免安装版 .exe...');

// 1. 清理或创建发行目录
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
}
fs.mkdirSync(releaseDir, { recursive: true });

// 辅助复制函数
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

// 2. 将原版 electron dist 复制过去
console.log('复制 Electron 运行时...');
if (!fs.existsSync(electronDist)) {
  console.error('致命错误: 找不到 node_modules/electron/dist，请先执行 npm install');
  process.exit(1);
}
copyRecursiveSync(electronDist, releaseDir);

// 3. 将项目本身转移进 resources/app 中
console.log('注入 StructPrompt 代码逻辑...');
fs.mkdirSync(appDir, { recursive: true });
const targetDirs = ['dist', 'electron', 'src', 'public'];
targetDirs.forEach(d => {
  const srcP = path.join(projectRoot, d);
  if (fs.existsSync(srcP)) copyRecursiveSync(srcP, path.join(appDir, d));
});
// Package.json needed for main entry
fs.copyFileSync(path.join(projectRoot, 'package.json'), path.join(appDir, 'package.json'));
// Keep dependencies by copying node_modules
console.log('注入依赖模块 (node_modules)...');
copyRecursiveSync(path.join(projectRoot, 'node_modules'), path.join(appDir, 'node_modules'));


// 4. 重命名 electron.exe 为产品名称
console.log('重塑产品为独立 exe...');
const exePath = path.join(releaseDir, 'electron.exe');
const newExePath = path.join(releaseDir, 'StructPrompt Studio.exe');
if (fs.existsSync(exePath)) {
  fs.renameSync(exePath, newExePath);
}

console.log('\\n✅ 封装成功！你可以直接双击运行:\\n' + newExePath + '\\n此文件夹可以直接打包发给任何人使用。');
