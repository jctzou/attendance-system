# 即時系統與頭像功能規格書 (Realtime System & Avatars Spec)

> **版本**: v1.1
> **狀態**: 已實作 (Implemented)
> **目標**: 統一管理全站「上班中人員名單」與「系統通知」的即時推送。透過共用的輕量級廣播架構 (Broadcast)，跨越權限阻礙，實現低延遲與高安全性的即時連動。

---

## 1. 功能概觀 (Feature Overview)

### 1.1 即時群體上班頭像 (Realtime Avatars)
- **即時同步**: 透過 Supabase Broadcast，當任一同事點擊「上班」、「下班」或「取消下班」時，所有掛在網頁上的使用者會在一秒內自動更新名單。
- **視覺呈現**: 頭像水平重疊堆疊 (`-ml-3`)，游標移入時會顯示浮動姓名標籤 (Tooltip)。
- **動態效果**: 使用 Framer Motion 實現 Q 彈的物理進場與優雅退場動畫。

### 1.2 即時系統通知 (Realtime Notifications)
- **即時紅點與列表**: 透過相同的 Broadcast 機制，當員工的假單被建立、核准或拒絕時，右上角的鈴鐺圖示會瞬間增加未讀數字，並同步更新下拉選單內容。
- **樂觀 UI (Optimistic UI)**: 收到廣播信號的瞬間即刻將數字 +1，隨後在背景向伺服器拉取最新列表，消除等待體驗。

---

## 2. 核心架構與權限旁路引用

> **🚨 重要架構依賴**：
> 本實作使用的 Supabase Broadcast 機制、Server Action `createAdminClient()` 繞過 RLS 的實作細節、以及「靜默丟棄 (Silent Drop)」的開發生死線，**請嚴格遵循 [系統架構白皮書 (system_architecture.md) §4 全域即時通訊與通知架構]** 的指示。本文件僅著重於前端視覺與動畫之邏輯。

---

## 3. 元件細節 (Component Details)

### 3.1 `WorkingEmployeesList.tsx` (Client Side)
- **封裝邏輯**: 
    - 使用 `AnimatePresence` 處理元件被移除時的退場動畫。
    - 使用 `motion.div` 包覆每個頭像。
- **動畫配置 (Framer Motion)**:
    - **進場 (Initial/Animate)**: `y: 20` -> `0`, `scale: 0.5` -> `1` (Spring 效果)。
    - **退場 (Exit)**: `y: -40`, `duration: 0.8s`, `ease: "easeInOut"`。
    - **補位 (Layout)**: 設定 `layout` 屬性，當某頭像消失時，其他頭像會平滑滑向新位置而非突閃。

### 3.2 `NotificationBell.tsx` (Client Side)
- **樂觀 UI (Optimistic UI)**: 透過元件內部的 state 直接在收到廣播的瞬間 `setUnreadCount(prev => prev + 1)`，製造無延遲的系統回饋感。
- **動畫配置 (Framer Motion)**:
    - 針對鈴鐺上的紅色未讀計數加註了 `<AnimatePresence>` 與 `<motion.span>`。
    - **彈指效果 (Pop-in)**: 透過關鍵影格 (Keyframes) `scale: [0, 1.3, 0.8, 1.1, 1]` 與精確的 `times` 屬性，在 0.4 秒內展現出純粹以大小縮放變化為主、極具彈跳動感 (Q彈) 的提示動畫，全程保持實心不透明以強化視覺捕捉。

---
