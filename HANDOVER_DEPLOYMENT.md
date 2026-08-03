# Deployment Handover Document

## 项目概述
这是一个 Sandboxels 人类社会模拟游戏项目，需要定期将本地修改同步到 Git 仓库并部署到公网服务器。

## Git 仓库
- **主仓库 (fork)**: `https://github.com/jackwang06/sandboxels.git`
  - 分支: `feature/human-society-sandbox`
  - Remote 名称: `fork`

- **独立仓库 (standalone)**: `https://github.com/jackwang06/human-society-sandbox.git`
  - 分支: `main`
  - Remote 名称: `standalone`
  - Worktree 路径: `/tmp/hss-standalone` (临时工作目录)

## 公网部署
- **域名**: https://terrabox.wadh.top
- **服务器**: `root@223.4.249.109`
- **SSH**: 已配置免密登录（使用 `wangy@toolofking` 的公钥）
- **部署目录**: `/opt/terrabox/site/`
- **服务**:
  - `cloudflared-hotstream.service` - Cloudflare Tunnel
  - `terrabox-web.service` - Web 服务

## 标准部署流程

### 1. 运行测试
在提交前，先确认所有测试通过：

```bash
cd /home/wangy/sandboxels

# 检查 JavaScript 语法
node --check scripts/human_society.js \
  scripts/human_society_core.js \
  scripts/human_society_world.js \
  scripts/human_society_tech_data.js \
  scripts/human_society_pathfinding.js

# 运行测试套件
node --test \
  tests/human_society_core.test.js \
  tests/human_society_world.test.js \
  tests/human_society_tech_data.test.js \
  tests/human_society_integration.test.js \
  tests/engine_overlap_speed.test.js \
  tests/human_society_pathfinding.test.js \
  tests/localization_zh_cn.test.js
```

所有测试必须通过才能继续。

### 2. 提交到 Git（版本发布）

用户会告诉你版本号（如 v5.0），按以下步骤提交：

```bash
cd /home/wangy/sandboxels

# 查看修改的文件
git status --short

# 添加所有相关文件（跳过 debug_*.html, test_*.html, dogfood-output/）
git add \
  README_AGENT_HANDOFF.md \
  index.html \
  lang/zh_cn.json \
  mods/ \
  scripts/ \
  tests/ \
  assets/ \
  pic/ \
  weaponpic/

# 提交并打标签
git commit -m "vX.X human society simulation

- 简要描述主要改动
- XXX automated tests passing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"

git tag vX.X

# 推送到主仓库
git push fork feature/human-society-sandbox --tags
```

### 3. 同步到独立仓库

```bash
# 创建临时工作目录（如果不存在）
git worktree add -q /tmp/hss-standalone standalone/main 2>&1 || true

# 同步所有文件（排除调试文件）
rsync -a --exclude='.git' /home/wangy/sandboxels/ /tmp/hss-standalone/ \
  --exclude='debug_*.html' \
  --exclude='test_*.html' \
  --exclude='dogfood-output/'

# 提交到独立仓库
cd /tmp/hss-standalone
git add -A
git commit -q -m "vX.X human society simulation"
git tag vX.X 2>/dev/null || true
git push standalone HEAD:main --tags

# 清理工作目录
cd /home/wangy/sandboxels
git worktree remove /tmp/hss-standalone 2>&1
```

### 4. 部署到服务器

**重要文件**：
- `index.html` → `/opt/terrabox/site/index.html`
- `scripts/*.js` → `/opt/terrabox/site/scripts/`
- `lang/*.json` → `/opt/terrabox/site/lang/`
- `mods/*.js` → `/opt/terrabox/site/mods/`
- `assets/`, `pic/`, `weaponpic/` → `/opt/terrabox/site/`（相应目录）

```bash
# 方式1: 使用 scp 批量上传（推荐）
scp /home/wangy/sandboxels/index.html root@223.4.249.109:/opt/terrabox/site/

scp /home/wangy/sandboxels/scripts/*.js \
    root@223.4.249.109:/opt/terrabox/site/scripts/

scp /home/wangy/sandboxels/lang/zh_cn.json \
    root@223.4.249.109:/opt/terrabox/site/lang/

scp /home/wangy/sandboxels/mods/runAfterAutogen2.js \
    root@223.4.249.109:/opt/terrabox/site/mods/

# 如果有新增的静态资源（图片等），用 scp -r
scp -r /home/wangy/sandboxels/assets \
       /home/wangy/sandboxels/pic \
       /home/wangy/sandboxels/weaponpic \
    root@223.4.249.109:/opt/terrabox/site/
```

### 5. 验证部署

```bash
# 检查文件大小（确认上传成功）
curl -sI "https://terrabox.wadh.top/scripts/human_society.js?v=$(date +%s)" | grep -i content-length

# 访问网站确认
curl -s "https://terrabox.wadh.top/" | grep -o "<title>.*</title>"
```

在浏览器打开 https://terrabox.wadh.top，按 Ctrl+F5 强制刷新，验证新功能。

## 常见问题排查

### 1. 网站返回 502/503/530
```bash
# 检查服务状态
ssh root@223.4.249.109 'systemctl status cloudflared-hotstream.service terrabox-web.service'

# 重启服务
ssh root@223.4.249.109 'systemctl restart cloudflared-hotstream.service terrabox-web.service'
```

### 2. SSH 连接超时
- 服务器可能宕机，用 `ping 223.4.249.109` 检查
- 磁盘可能满了（历史问题），重启服务器可临时恢复
- 检查磁盘使用：`ssh root@223.4.249.109 'df -h'`

### 3. Git 推送失败
```bash
# 检查当前分支
git branch --show-current

# 拉取最新代码再推送
git pull fork feature/human-society-sandbox
git push fork feature/human-society-sandbox --tags
```

### 4. 测试失败
- 查看具体失败的测试输出
- 修复代码或测试用例
- 不要强制跳过测试直接提交

## 文件说明

**跳过提交的文件**：
- `debug_overlap.html`, `test_datalist.html` - 临时调试页面
- `dogfood-output/` - 测试输出
- `.git/` - Git 元数据

**必须提交的文件**：
- `scripts/human_society*.js` - 核心游戏逻辑
- `tests/*.test.js` - 自动化测试
- `index.html` - 主页面
- `lang/zh_cn.json` - 中文本地化
- `assets/`, `pic/`, `weaponpic/` - 游戏资源

## 版本历史参考

- **v4.0** (766a3f3a) - 186 tests passing, 新增建筑/武器图片资源
- **v3.0** (90af22a6) - 132 tests passing, 新增寻路系统
- **v2.x** - 元素重叠UI改进

## 注意事项

1. **所有部署前必须跑测试**，测试不通过不要提交
2. **版本号由用户指定**，不要自己决定版本号
3. **提交信息要包含测试数量**（如"186 automated tests passing"）
4. **独立仓库的标签可能已存在**，用 `git tag vX.X 2>/dev/null || true` 忽略错误
5. **服务器免密登录已配置**，直接 `ssh root@223.4.249.109` 即可
6. **静态资源只在新增时才需要上传**，纯代码修改不需要重传图片

## 快速参考命令

```bash
# 完整发布流程（假设版本号是 v5.0）
cd /home/wangy/sandboxels
node --test tests/*.test.js
git add scripts/ tests/ index.html lang/ mods/ assets/ pic/ weaponpic/
git commit -m "v5.0 human society simulation\n\n- XXX automated tests passing\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag v5.0
git push fork feature/human-society-sandbox --tags

# 同步独立仓库
git worktree add -q /tmp/hss-standalone standalone/main 2>&1 || true
rsync -a --exclude='.git' --exclude='debug_*.html' --exclude='test_*.html' --exclude='dogfood-output/' /home/wangy/sandboxels/ /tmp/hss-standalone/
cd /tmp/hss-standalone && git add -A && git commit -q -m "v5.0 human society simulation" && git tag v5.0 2>/dev/null && git push standalone HEAD:main --tags
cd /home/wangy/sandboxels && git worktree remove /tmp/hss-standalone

# 部署到服务器
scp index.html root@223.4.249.109:/opt/terrabox/site/
scp scripts/*.js root@223.4.249.109:/opt/terrabox/site/scripts/
scp lang/zh_cn.json root@223.4.249.109:/opt/terrabox/site/lang/
scp mods/runAfterAutogen2.js root@223.4.249.109:/opt/terrabox/site/mods/

# 验证
curl -sI "https://terrabox.wadh.top/scripts/human_society.js?v=$(date +%s)" | grep content-length
```

---

**联系信息**：
- Git 用户: `jackwang06`
- 服务器 SSH: `root@223.4.249.109` (免密登录已配置)
- 本地开发用户: `wangy@toolofking`
