-- Migration: 修正多日請假（group_id 架構）導致的通知重複問題
-- 問題：FOR EACH ROW 觸發器在批次 INSERT/UPDATE 時，每筆 row 各發一次通知
--       加上 Server Action 也呼叫 createNotification → 通知數 = 天數 × 2
-- 解法：改為 FOR EACH ROW 但以 group_id 去重（只對 group 內的第一筆 row 發通知）
--       並統一中文假別顯示

-- =========================================================================
-- 請假申請 & 審核通知觸發器（去重版）
-- =========================================================================

CREATE OR REPLACE FUNCTION handle_leave_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_record RECORD;
    user_display_name TEXT;
    leave_type_zh TEXT;
    total_days NUMERIC;
    is_first_in_group BOOLEAN;
BEGIN
    -- 取得申請人顯示名稱
    SELECT display_name INTO user_display_name FROM public.users WHERE id = NEW.user_id;

    -- 將 leave_type 轉為中文
    leave_type_zh := CASE NEW.leave_type
        WHEN 'sick_leave'     THEN '病假'
        WHEN 'personal_leave' THEN '事假'
        WHEN 'annual_leave'   THEN '特休'
        WHEN 'annual'         THEN '特休'
        ELSE '其他假'
    END;

    -- 計算此 group_id 的目前總請假天數（含本筆）
    SELECT COALESCE(SUM(days), 0) INTO total_days
    FROM public.leaves
    WHERE group_id = NEW.group_id AND user_id = NEW.user_id;

    -- 【去重核心】：判斷本筆 row 是否為此 group_id 中 id 最小的那筆（即第一筆）
    -- 只有第一筆才發通知，後續同 group_id 的 row 略過
    SELECT (NEW.id = MIN(id)) INTO is_first_in_group
    FROM public.leaves
    WHERE group_id = NEW.group_id AND user_id = NEW.user_id;

    -- 無 group_id 的舊資料（legacy）視為獨立一筆，永遠發通知
    IF NEW.group_id IS NULL THEN
        is_first_in_group := TRUE;
    END IF;

    IF NOT is_first_in_group THEN
        RETURN NEW; -- 非第一筆，略過，不發通知
    END IF;

    -- ---- INSERT 事件：新請假申請 ----
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            FOR admin_record IN (
                SELECT id FROM public.users WHERE role IN ('manager', 'super_admin')
            ) LOOP
                INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
                VALUES (
                    admin_record.id,
                    'new_leave_request',
                    '新的請假申請',
                    user_display_name || ' 申請了 ' || leave_type_zh || '（共 ' || total_days || ' 天）',
                    '/admin/leaves',
                    false
                );
            END LOOP;
        END IF;

    -- ---- UPDATE 事件：審核結果 ----
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
            INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
            VALUES (
                NEW.user_id,
                'leave_approved',
                '請假申請已核准',
                '您的 ' || leave_type_zh || '（共 ' || total_days || ' 天）申請已核准',
                '/leaves',
                false
            );

        ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
            VALUES (
                NEW.user_id,
                'leave_rejected',
                '請假申請遭退回',
                '您的 ' || leave_type_zh || '（共 ' || total_days || ' 天）申請遭退回',
                '/leaves',
                false
            );

        ELSIF OLD.status = 'approved' AND NEW.status = 'cancel_pending' THEN
            -- 員工申請取消已批准假單 → 通知主管
            FOR admin_record IN (
                SELECT id FROM public.users WHERE role IN ('manager', 'super_admin')
            ) LOOP
                INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
                VALUES (
                    admin_record.id,
                    'leave_cancel_request',
                    '請假取消申請',
                    user_display_name || ' 申請取消 ' || leave_type_zh || ' 假單',
                    '/admin/leaves',
                    false
                );
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 重建觸發器（移除舊的，套用新函式）
DROP TRIGGER IF EXISTS on_leave_changed ON public.leaves;

CREATE TRIGGER on_leave_changed
    AFTER INSERT OR UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION handle_leave_notifications();


-- leave_cancellations 資料表已於先前 migration 刪除，無需處理其觸發器。
