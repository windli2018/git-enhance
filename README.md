# Git Enhance

English | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md)

A collection of useful Git workflow enhancements for VS Code.

## Features

### Cross-File Diff Navigation

Enhance your Git diff navigation experience by removing the single-file loop behavior and enabling seamless cross-file change navigation.

**Key Features:**
- 🔄 Navigate between changes across multiple modified files
- 🚫 No more looping within a single file
- 📢 Clear notifications when reaching file boundaries
- 🔁 Review loop detection - notifies when you've completed a full review cycle
- ⚙️ Fully configurable and can be disabled to restore default VS Code behavior
- 🌍 Multi-language support (English, Chinese Simplified, Chinese Traditional)

**How it works:**
1. When you reach the last change in a file and press `F7` (Next Change):
   - First press: Shows a notification "Reached last change in current file. Click again to jump to next file"
   - Second press: Automatically jumps to the first change of the next modified file

2. When you reach the first change in a file and press `Shift+F7` (Previous Change):
   - First press: Shows a notification "Reached first change in current file. Click again to jump to previous file"
   - Second press: Automatically jumps to the last change of the previous modified file

3. File order follows the Source Control panel's file list (top to bottom)

4. When reaching the last file, loops back to the first file (configurable)

5. **Review Loop Detection:**
   - The extension tracks your review session across files
   - When you navigate back to the starting file in the same direction and have already reviewed it (reached its boundary), you'll see a "You have completed a full review cycle" notification
   - This helps you know when you've completed a full review of all changes
   - The session tracking is maintained per editor mode (compare/normal) and direction (next/previous)

## Configuration

This extension provides the following settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `gitEnhance.crossFileNavigation.enabled` | boolean | `true` | Enable/disable cross-file navigation feature. When disabled, restores original VS Code behavior |
| `gitEnhance.crossFileNavigation.notificationDuration` | number | `5000` | Notification auto-dismiss duration (milliseconds) |
| `gitEnhance.crossFileNavigation.enableLoopAcrossAllFiles` | boolean | `true` | Enable looping from last file back to first file |
| `gitEnhance.crossFileNavigation.maxOpenEditors` | number | `10` | Maximum number of editors to keep open during cross-file navigation |
| `gitEnhance.crossFileNavigation.enableReviewLoop` | boolean | `true` | Enable review loop detection. When enabled, notifies you when you've completed a full review cycle |
| `gitEnhance.crossFileNavigation.notificationMode` | string | `smart` | Control when to show boundary notifications: `smart` (first 3 times per session), `always`, or `never` |

### Example Configuration

Add to your VS Code `settings.json`:

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

## Usage

1. Open a Git repository with modified files
2. Open any modified file in diff view (click on a file in the Source Control panel)
3. Use `F7` (Next Change) and `Shift+F7` (Previous Change) to navigate
4. When you reach the boundary of a file, press the same key again to jump to the next/previous file

## Requirements

- VS Code 1.80.0 or higher
- A Git repository with modified files

## Extension Architecture

Git Enhance is designed as an extensible platform for Git-related enhancements. The cross-file diff navigation is the first feature, with more features planned for future releases.

### Planned Features (TODO)

The following features are under consideration for future releases:

**Code Review & Annotation:**
- [ ] Line-level annotations and comments
- [ ] File-level notes and remarks
- [ ] Annotation processing and management
- [ ] Send file diffs to AI for review and suggestions
- [ ] Batch send line-level and file-level annotations to AI for analysis

**Commit Management:**
- [ ] Modify commit author information
- [ ] Edit recent commit messages
- [ ] Batch commit message updates

## Known Issues

- Boundary detection is currently heuristic-based and may not be 100% accurate in all scenarios
- The extension works best with Git-managed files in the Source Control panel

## Release Notes

### 0.1.0

Initial release with cross-file diff navigation feature:
- Cross-file navigation with two-step confirmation
- Multi-language support (en, zh-cn, zh-tw)
- Configurable behavior
- Feature toggle to restore default VS Code behavior

## Contributing

This extension is open source. Contributions, issues, and feature requests are welcome!

Repository: [https://github.com/windli2018/git-enhance](https://github.com/windli2018/git-enhance)

## License

Apache-2.0

---

**Enjoy enhanced Git workflow in VS Code!**
