/**
 * 系統功能開關 (Feature Flags)
 * 統一管理環境變數配置，方便前端元件存取全域設定。
 */

export const features = {
    /**
     * 鐘點人員異常狀態顯示開關
     * 若為 true: 顯示鐘點人員的遲到、早退標籤 (紅字)
     * 若為 false: 依照預設隱藏鐘點人員的異常標籤，維持版面乾淨
     */
    showHourlyStatus: process.env.NEXT_PUBLIC_SHOW_HOURLY_STATUS === 'true',
};
