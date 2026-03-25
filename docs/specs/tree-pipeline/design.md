# Spec: DAG Modifier Pipeline

## Summary

将扁平 modifier 列表重构为 DAG（有向无环图）。所有节点都是 Modifier，没有新概念。SelectModifier 产出选区，下游 modifier 通过 `selectionModifierId` 声明依赖关系。UI 用缩进树展示依赖关系。

## Motivation

当前问题：
1. selection-sensitive modifier 在添加时快照选区索引 → 和 SelectModifier 脱耦，修改选区不会更新下游
2. 扁平列表看不出谁依赖谁
3. 删除 SelectModifier 后下游 modifier 持有失效索引
4. `ModifierCategory.SelectionSensitive` 只是标签，没有实际绑定

## Scope

**In scope:**
- DAG 数据模型（`Modifier` + `parentId` 依赖引用）
- DAG-aware `compute()` — 解析依赖，注入正确的 `currentSelection`
- React 树形 UI（缩进、展开/折叠、拖拽重排 + 挂载/脱离）
- selection-sensitive modifier 从父 SelectModifier 自动继承选区
- 删除 SelectModifier 弹窗确认，级联删除子 modifier
- 拓扑修改型 modifier（Hide/Delete）强制根层级

**Out of scope:**
- 2D 节点图编辑器（用树形缩进即可表达 DAG）
- Undo/redo pipeline 操作
- 序列化/持久化

## Design

### 核心原则：一切皆 Modifier

没有 "scope"、"source"、"node type" 等新概念。`Modifier` 接口不变，只增加一个可选的 `parentId` 字段：

```typescript
// 对 Modifier 接口的唯一扩展
export interface Modifier {
  // ... existing fields (id, name, enabled, category, validate, apply, getCacheKey)

  /**
   * 当前 modifier 依赖的 SelectModifier 的 id。
   * 非 null 时，compute() 会先解析该 SelectModifier 的选区，
   * 注入 context.currentSelection 后再调用 apply()。
   * 只有 SelectionSensitive 类型的 modifier 可以设置此字段。
   */
  parentId: string | null;
}
```

### Modifier ID 命名

用 NATO 音标字母表递增分配，人类可读：

```typescript
const NATO = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot",
  "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima",
  "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo",
  "Sierra", "Tango", "Uniform", "Victor", "Whiskey",
  "X-ray", "Yankee", "Zulu",
];

function nextModifierId(existing: string[]): string {
  // 第 1 轮: Alpha, Bravo, ...
  // 第 2 轮: Alpha-2, Bravo-2, ...
  const round = Math.floor(existing.length / 26);
  const index = existing.length % 26;
  return round === 0 ? NATO[index] : `${NATO[index]}-${round + 1}`;
}
```

### DAG 结构示例

```
DataSource (id: Alpha)                     parentId: null
WrapPBC (id: Bravo)                        parentId: null
Select "ring" (id: Charlie, 13 atoms)      parentId: null
  ├─ AssignColor #FF0000 (id: Delta)       parentId: "Charlie"
  └─ Transparent 0.35 (id: Echo)           parentId: "Charlie"
Select "backbone" (id: Foxtrot, 8 atoms)   parentId: null
  └─ HideSelection (id: Golf)              parentId: "Foxtrot" ← 禁止！拓扑修改型强制根层级
Slice (id: Golf)                           parentId: null
HideSelection (id: Hotel)                  parentId: null       ← 正确：根层级
```

### DAG 约束

| 规则 | 说明 |
|------|------|
| **拓扑修改型强制根层级** | Hide、Delete、HideHydrogens 的 `parentId` 必须为 null |
| **SelectionInsensitive 强制根层级** | Slice、WrapPBC、ColorByProperty 的 `parentId` 必须为 null |
| **parentId 只能指向 SelectModifier 或 ExpressionSelectionModifier** | 不能指向普通 modifier |
| **无环** | A 依赖 B，B 不能直接或间接依赖 A |
| **深度不限** | 理论上 Select → Select → Transparent 是合法的（嵌套选区） |

### Compute 逻辑

```typescript
async compute(modifiers: Modifier[], source, frameIndex, app): Frame {
  let frame = await source.getFrame(frameIndex);
  const context = createDefaultContext(frame, app, frameIndex);

  // 1. 收集所有 SelectModifier 产出的选区
  const selectionCache = new Map<string, SelectionMask>();

  for (const mod of modifiers) {
    if (!mod.enabled) continue;

    // 2. 解析 parentId → 注入 currentSelection
    if (mod.parentId) {
      const parentMask = selectionCache.get(mod.parentId);
      if (parentMask) {
        context.currentSelection = parentMask;
      }
    } else {
      // 根层级 modifier 看到全选
      context.currentSelection = SelectionMask.all(atomCount);
    }

    // 3. apply
    frame = mod.apply(frame, context);

    // 4. 如果是 selection-producing modifier，缓存其选区
    if (mod instanceof SelectModifier || mod instanceof ExpressionSelectionModifier) {
      const mask = context.selectionSet.get(mod.id);
      if (mask) selectionCache.set(mod.id, mask);
    }
  }

  emit("computed", { frame, context });
  return frame;
}
```

执行顺序仍然是数组顺序（用户可拖拽调整）。`parentId` 只决定选区注入，不改变执行顺序。

### 修改后的 Modifier 行为

| Modifier | 当前 | 重构后 |
|----------|------|--------|
| **SelectModifier** | 写 `context.selectionSet` | 不变。产出选区，供下游引用 |
| **ExpressionSelectionModifier** | 写 `context.selectionSet` | 不变。产出选区，供下游引用 |
| **TransparentSelectionModifier** | 存 `_indices`，忽略 context | 删除 `_indices`，读 `context.currentSelection`（来自 parentId 解析） |
| **AssignColorModifier** | 存 `_assignments[].indices` | 读 `context.currentSelection`，只存颜色 |
| **HideSelectionModifier** | 存 `_hiddenIndices` | 读 `context.currentSelection`。**强制 parentId = null** |
| **DeleteSelectedModifier** | 存 `_deletedIndices` | 读 `context.currentSelection`。**强制 parentId = null** |
| **HideHydrogensModifier** | 无选区 | 不变。强制 parentId = null |
| **SliceModifier** | 无选区 | 不变。强制 parentId = null |

### UI

#### 树形视图

```
┌─ Pipeline ─────────────────────────────────┐
│                                            │
│  ≡ [v] Data Source                         │
│  ≡ [v] Wrap PBC                           │
│  ▼ [v] Select "ring carbons"  (13)        │ ← 点击展开/折叠子 modifier
│     ≡ [v]  Assign Color  #FF0000      🗑  │ ← 缩进 24px
│     ≡ [v]  Transparent   0.35         🗑  │
│  ▶ [v] Select "backbone"  (8)             │ ← 折叠状态
│  ≡ [v] Hide Selection                      │ ← 根层级（拓扑修改型）
│  ≡ [v] Slice                               │
│                                            │
│  [+ Add Modifier]                          │
│                                            │
└────────────────────────────────────────────┘
```

- **所有节点都是 modifier**，只是 UI 上通过 `parentId` 做缩进
- SelectModifier 行有展开/折叠 chevron（有子 modifier 时）
- 根层级 modifier 无缩进
- 拖拽：可以把 selection-sensitive modifier 拖到 SelectModifier 下方（设置 parentId）；不能把拓扑修改型拖进去

#### 添加 Modifier 交互

| 场景 | 行为 |
|------|------|
| 点击 SelectModifier 行的 "+" 图标 | 弹出 dropdown：只显示 selection-sensitive 且非拓扑修改型（Transparent、AssignColor） |
| 点击底部 "+ Add Modifier" | 弹出 dropdown：显示所有 modifier 类型。如果选中 selection-sensitive 类型，自动挂到最近的 SelectModifier 下 |
| 先选原子 → 点 "+ Add Modifier" → 选 Transparent | 如果当前无 SelectModifier，先自动创建一个，再把 Transparent 挂上去 |

#### 删除 SelectModifier

弹出确认对话框：

```
┌──────────────────────────────────────┐
│  Delete "ring carbons"?              │
│                                      │
│  This will also delete:              │
│  • Assign Color                      │
│  • Transparent                       │
│                                      │
│            [Cancel]  [Delete]        │
└──────────────────────────────────────┘
```

#### Properties 面板

点击任何 modifier 行，下方显示其参数面板。

**SelectModifier (Charlie):**
```
┌─ CHARLIE · SELECT ────────────────────┐
│  Label:    [ring carbons         ]    │
│  Mode:     replace                    │
│  Atoms:    13                         │
│  Bonds:    0                          │
│  [v] Show Highlight                   │
│  [Re-capture from Current Selection]  │
└───────────────────────────────────────┘
```

**selection-sensitive modifier (如 Transparent, AssignColor, ComputeRDF):**
```
┌─ ECHO · TRANSPARENT ─────────────────┐
│  Depends on: [Charlie ▼]             │  ← dropdown: 列出所有 selection-producing modifier
│  Transparency: [0.35]                 │
└───────────────────────────────────────┘
```

"Depends on" dropdown 列出所有 SelectModifier 和 ExpressionSelectionModifier 的 id + label。切换后自动设置 `parentId` 并 re-apply pipeline。

### Events

在现有 `ModifierPipeline` 上新增：

| Event | Payload |
|-------|---------|
| `modifier-reparented` | `{ modifierId, oldParentId, newParentId }` |

其余现有事件（`modifier-added`, `modifier-removed`, `modifier-reordered`, `computed`）不变。

## 重构计划

### Phase 0: 准备（0.5 天）
- 在 `Modifier` 接口上加 `parentId: string | null`（默认 null）
- 所有现有 modifier 的 `parentId` 设为 null
- 不影响现有行为

### Phase 1: Compute 引擎（1-2 天）
- `compute()` 增加 parentId 解析逻辑：遍历时根据 `mod.parentId` 查 `selectionCache` 注入 `currentSelection`
- 加 DAG 约束校验（拓扑修改型不能有 parent、parentId 只能指向 selection-producing modifier、无环检查）
- 单元测试

### Phase 2: Modifier 重构（1-2 天）
- TransparentSelectionModifier: 删 `_indices`，读 `context.currentSelection`
- AssignColorModifier: 删 `_assignments[].indices`，读 `context.currentSelection`
- HideSelectionModifier: 删 `_hiddenIndices`，读 `context.currentSelection`，enforce `parentId = null`
- DeleteSelectedModifier: 同上
- 更新所有对应的单元测试

### Phase 3: UI 树形渲染（2-3 天）
- 按 `parentId` 分组渲染缩进树
- SelectModifier 行增加展开/折叠 chevron 和 "+" 子 modifier 按钮
- 拖拽重排 + 挂载/脱离（设置 parentId）
- 拖拽约束：拓扑修改型不能挂载
- 删除 SelectModifier 确认弹窗 + 级联删除

### Phase 4: 清理（0.5 天）
- 删除所有 modifier 的 `_indices` / `_hiddenIndices` / `_deletedIndices`
- 删除 "Captured Atoms"、"Use Current Selection" UI
- 删除 `getSelectedAtomIndices` helper

**总计：5-8 天**

## Test Criteria

**Unit (core):**
- parentId 解析：子 modifier 收到父 SelectModifier 的选区
- 根层级 modifier 收到 SelectionMask.all()
- 拓扑修改型设置 parentId 时 validate 报错
- 无环校验
- 禁用 SelectModifier → 子 modifier 的 postRenderEffects 不执行
- 嵌套选区：Select A → Select B(parentId: A) → Transparent(parentId: B)

**Integration (page):**
- 选原子 → Add Modifier → Select 自动创建 + 子 modifier 挂载
- 拖拽 modifier 到 SelectModifier 下 → 重新挂载
- 删除 SelectModifier → 弹窗 → 确认 → 级联删除
- 折叠/展开 SelectModifier → 子 modifier 隐藏/显示

## 已确认的设计决策

1. **执行顺序即数组顺序，不做拓扑排序。** 如果 Transparent 排在 Select 前面，`selectionCache` 里没有该选区，Transparent 就作用于全体原子。这是正确的语义——modifier 的位置决定了它的作用范围。

2. **单 parent。** 一个 modifier 只能依赖一个 SelectModifier。不需要多 parent。

3. **需要选择依赖的 modifier（如 ComputeRDF）在 properties 面板里通过 dropdown 选择 parentId。** 这比隐式依赖更清晰。

4. **Modifier ID 使用可读名称。** 不用 `sel-1703456789`，用 NATO 风格递增命名：Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliet, Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo, Sierra, Tango, Uniform, Victor, Whiskey, X-ray, Yankee, Zulu。超过 26 个后加数字后缀（Alpha-2, Bravo-2...）。

## Remaining Risks

1. **dnd-kit 树形拖拽**: 现有 `@dnd-kit/sortable` 不直接支持树形。需要 `dnd-kit-sortable-tree` 或自行实现 flattened tree + indentation。

2. **ExpressionSelectionModifier 也能做 parent**: 它产出选区，所以可以有子 modifier 挂载。需要确保 expression 重新求值时子 modifier 自动更新。
