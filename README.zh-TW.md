# Git Enhance

[English](README.md) | [简体中文](README.zh-CN.md) | 繁體中文

一套實用的 VS Code Git 工作流程增強工具集合。

## 功能特性

### 跨檔案差異導覽

通過移除單檔案循環行為並啟用無縫的跨檔案變更導覽，增強您的 Git 差異瀏覽體驗。

**核心功能：**
- 🔄 在多個修改檔案之間導覽變更
- 🚫 不再在單個檔案內循環
- 📢 到達檔案邊界時清晰的通知提示
- 🔁 審查循環檢測 - 當您完成一輪完整審查時發出通知
- ⚙️ 完全可配置，可停用以恢復預設 VS Code 行為
- 🌍 多語言支援（英語、簡體中文、繁體中文）

**工作原理：**
1. 當到達檔案最後一處更改並按下 `F7`（下一處更改）時：
   - 第一次按下：顯示通知「已到達當前檔案最後一處更改。再次點擊跳轉到下一個檔案」
   - 第二次按下：自動跳轉到下一個修改檔案的第一處更改

2. 當到達檔案第一處更改並按下 `Shift+F7`（上一處更改）時：
   - 第一次按下：顯示通知「已到達當前檔案第一處更改。再次點擊跳轉到上一個檔案」
   - 第二次按下：自動跳轉到上一個修改檔案的最後一處更改

3. 檔案順序遵循原始檔控制面板的檔案列表（從上到下）

4. 到達最後一個檔案時，循環回到第一個檔案（可配置）

5. **審查循環檢測：**
   - 擴充功能會追蹤您在檔案間的審查工作階段
   - 當您以相同方向導覽回到起始檔案且已審查過它（到達其邊界）時，將看到「已完成本輪審查循環」通知
   - 這幫助您了解何時完成了所有變更的完整審查
   - 工作階段追蹤按編輯器模式（對比/普通）和方向（下一個/上一個）分別維護

## 配置

本擴充功能提供以下設定：

| 設定 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `gitEnhance.crossFileNavigation.enabled` | boolean | `true` | 啟用/停用跨檔案導覽功能。停用時，恢復 VS Code 原始預設行為 |
| `gitEnhance.crossFileNavigation.notificationDuration` | number | `5000` | 通知自動消失時長（毫秒） |
| `gitEnhance.crossFileNavigation.stateResetTimeout` | number | `5000` | 待跳轉狀態重置時間（毫秒） |
| `gitEnhance.crossFileNavigation.enableLoopAcrossAllFiles` | boolean | `true` | 啟用從最後一個檔案循環到第一個檔案 |
| `gitEnhance.crossFileNavigation.maxOpenEditors` | number | `10` | 跨檔案導覽期間保持開啟的最大編輯器數量 |
| `gitEnhance.crossFileNavigation.enableReviewLoop` | boolean | `true` | 啟用審查循環檢測。啟用後，當您完成一輪完整的審查並返回到之前已審查過的檔案時，擴充功能將通知您 |
| `gitEnhance.crossFileNavigation.notificationMode` | string | `smart` | 控制何時顯示邊界通知：`smart`（每次工作階段前 3 次）、`always` 或 `never` |

### 配置示例

在您的 VS Code `settings.json` 中新增：

```json
{
  "gitEnhance.crossFileNavigation.enabled": true,
  "gitEnhance.crossFileNavigation.notificationDuration": 5000,
  "gitEnhance.crossFileNavigation.stateResetTimeout": 5000,
  "gitEnhance.crossFileNavigation.enableLoopAcrossAllFiles": true,
  "gitEnhance.crossFileNavigation.maxOpenEditors": 10,
  "gitEnhance.crossFileNavigation.enableReviewLoop": true,
  "gitEnhance.crossFileNavigation.notificationMode": "smart"
}
```

## 使用方法

1. 開啟一個有修改檔案的 Git 儲存庫
2. 在差異檢視中開啟任意修改的檔案（點選原始檔控制面板中的檔案）
3. 使用 `F7`（下一處更改）和 `Shift+F7`（上一處更改）進行導覽
4. 當到達檔案邊界時，再次按下相同的鍵跳轉到下一個/上一個檔案

## 要求

- VS Code 1.80.0 或更高版本
- 一個包含修改檔案的 Git 儲存庫

## 擴充功能架構

Git Enhance 被設計為一個可擴充的 Git 相關增強功能平台。跨檔案差異導覽是第一個功能，未來版本將推出更多功能。

## 已知問題

- 邊界檢測目前基於啟發式方法，在某些場景下可能不是 100% 準確
- 擴充功能在原始檔控制面板中的 Git 管理檔案上效果最佳

## 版本說明

### 0.1.0

初始版本，包含跨檔案差異導覽功能：
- 帶兩步確認的跨檔案導覽
- 多語言支援（英語、簡體中文、繁體中文）
- 可配置行為
- 功能開關可恢復預設 VS Code 行為

## 貢獻

本擴充功能是開源的。歡迎貢獻、提出問題和功能請求！

儲存庫：[https://github.com/windli2018/git-enhance](https://github.com/windli2018/git-enhance)

## 授權條款

Apache-2.0

---

**在 VS Code 中享受增強的 Git 工作流程！**
