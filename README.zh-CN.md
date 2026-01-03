# Git Enhance

[English](README.md) | 简体中文 | [繁體中文](README.zh-TW.md)

一套实用的 VS Code Git 工作流增强工具集合。

## 功能特性

### 跨文件差异导航

通过移除单文件循环行为并启用无缝的跨文件变更导航，增强您的 Git 差异浏览体验。

**核心功能：**
- 🔄 在多个修改文件之间导航变更
- 🚫 不再在单个文件内循环
- 📢 到达文件边界时清晰的通知提示
- 🔁 审查循环检测 - 当您完成一轮完整审查时发出通知
- ⚙️ 完全可配置，可禁用以恢复默认 VS Code 行为
- 🌍 多语言支持（英语、简体中文、繁体中文）

**工作原理：**
1. 当到达文件最后一处更改并按下 `F7`（下一处更改）时：
   - 第一次按下：显示通知"已到达当前文件最后一处更改。再次点击跳转到下一个文件"
   - 第二次按下：自动跳转到下一个修改文件的第一处更改

2. 当到达文件第一处更改并按下 `Shift+F7`（上一处更改）时：
   - 第一次按下：显示通知"已到达当前文件第一处更改。再次点击跳转到上一个文件"
   - 第二次按下：自动跳转到上一个修改文件的最后一处更改

3. 文件顺序遵循源代码管理面板的文件列表（从上到下）

4. 到达最后一个文件时，循环回到第一个文件（可配置）

5. **审查循环检测：**
   - 扩展会跟踪您在文件间的审查会话
   - 当您以相同方向导航回到起始文件且已审查过它（到达其边界）时，将看到"已完成本轮审查循环"通知
   - 这帮助您了解何时完成了所有变更的完整审查
   - 会话跟踪按编辑器模式（对比/普通）和方向（下一个/上一个）分别维护

## 配置

本扩展提供以下设置：

| 设置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `gitEnhance.crossFileNavigation.enabled` | boolean | `true` | 启用/禁用跨文件导航功能。禁用时，恢复 VS Code 原始默认行为 |
| `gitEnhance.crossFileNavigation.notificationDuration` | number | `5000` | 通知自动消失时长（毫秒） |
| `gitEnhance.crossFileNavigation.enableLoopAcrossAllFiles` | boolean | `true` | 启用从最后一个文件循环到第一个文件 |
| `gitEnhance.crossFileNavigation.maxOpenEditors` | number | `10` | 跨文件导航期间保持打开的最大编辑器数量 |
| `gitEnhance.crossFileNavigation.enableReviewLoop` | boolean | `true` | 启用审查循环检测。启用后，当您完成一轮完整的审查并返回到之前已审查过的文件时，扩展将通知您 |
| `gitEnhance.crossFileNavigation.notificationMode` | string | `smart` | 控制何时显示边界通知：`smart`（每次会话前 3 次）、`always` 或 `never` |

### 配置示例

在您的 VS Code `settings.json` 中添加：

```json
{
  "gitEnhance.crossFileNavigation.enabled": true,
  "gitEnhance.crossFileNavigation.notificationDuration": 5000,
  "gitEnhance.crossFileNavigation.enableLoopAcrossAllFiles": true,
  "gitEnhance.crossFileNavigation.maxOpenEditors": 10,
  "gitEnhance.crossFileNavigation.enableReviewLoop": true,
  "gitEnhance.crossFileNavigation.notificationMode": "smart"
}
```

## 使用方法

1. 打开一个有修改文件的 Git 仓库
2. 在差异视图中打开任意修改的文件（点击源代码管理面板中的文件）
3. 使用 `F7`（下一处更改）和 `Shift+F7`（上一处更改）进行导航
4. 当到达文件边界时，再次按下相同的键跳转到下一个/上一个文件

## 要求

- VS Code 1.80.0 或更高版本
- 一个包含修改文件的 Git 仓库

## 扩展架构

Git Enhance 被设计为一个可扩展的 Git 相关增强功能平台。跨文件差异导航是第一个功能，未来版本将推出更多功能。

### 计划功能（TODO）

以下功能正在考虑在未来版本中实现：

**代码审查与注释：**
- [ ] 行级注释和备注
- [ ] 文件级笔记和说明
- [ ] 备注处理与管理
- [ ] 将文件差异发送到 AI 进行审查和建议
- [ ] 批量发送行级和文件级备注到 AI 进行分析

**提交管理：**
- [ ] 修改提交作者信息
- [ ] 编辑最近的提交消息
- [ ] 批量更新提交消息

## 已知问题

- 边界检测目前基于启发式方法，在某些场景下可能不是 100% 准确
- 扩展在源代码管理面板中的 Git 管理文件上效果最佳

## 版本说明

### 0.1.0

初始版本，包含跨文件差异导航功能：
- 带两步确认的跨文件导航
- 多语言支持（英语、简体中文、繁体中文）
- 可配置行为
- 功能开关可恢复默认 VS Code 行为

## 贡献

本扩展是开源的。欢迎贡献、提出问题和功能请求！

仓库：[https://github.com/windli2018/git-enhance](https://github.com/windli2018/git-enhance)

## 许可证

Apache-2.0

---

**在 VS Code 中享受增强的 Git 工作流！**
