-- 建立負責處理「請假申請與審核」的通知觸發器
CREATE OR REPLACE FUNCTION handle_leave_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- 使用建立者的高權限執行，繞過一般員工的 RLS 限制
AS $$
DECLARE
    admin_record RECORD;
    user_display_name TEXT;
BEGIN
    -- 取得申請人的顯示名稱，用於套用在通知訊息中
    SELECT display_name INTO user_display_name FROM public.users WHERE id = NEW.user_id;

    -- 針對新申請 (INSERT)
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            -- 迴圈找出所有管理員並派發通知
            FOR admin_record IN (SELECT id FROM public.users WHERE role IN ('manager', 'super_admin')) LOOP
                INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
                VALUES (
                    admin_record.id, 
                    'new_leave_request', 
                    '新的請假申請', 
                    user_display_name || ' 有新的請假申請待審核', 
                    '/admin/leaves', 
                    false
                );
            END LOOP;
        END IF;
    
    -- 針對狀態更新 (UPDATE - 如審核通過或退回)
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
            -- 通知申請人審核已通過
            INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
            VALUES (NEW.user_id, 'leave_approved', '請假已批准', '您的請假申請已通過審核', '/leaves', false);
            
        ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
            -- 通知申請人審核被退回
            INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
            VALUES (NEW.user_id, 'leave_rejected', '請假被退回', '您的請假申請被退回', '/leaves', false);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 移除舊的觸發器 (避免重複執行報錯)
DROP TRIGGER IF EXISTS on_leave_changed ON public.leaves;

-- 將這隻函式綁定到 leaves 資料表的變動事件上
CREATE TRIGGER on_leave_changed
    AFTER INSERT OR UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION handle_leave_notifications();


-- =========================================================================


-- 建立負責處理「取消請假申請與審核」的通知觸發器
CREATE OR REPLACE FUNCTION handle_leave_cancellation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_record RECORD;
    user_display_name TEXT;
BEGIN
    SELECT display_name INTO user_display_name FROM public.users WHERE id = NEW.user_id;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            FOR admin_record IN (SELECT id FROM public.users WHERE role IN ('manager', 'super_admin')) LOOP
                INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
                VALUES (
                    admin_record.id, 
                    'leave_cancel_request', 
                    '請假取消申請', 
                    user_display_name || ' 申請取消請假', 
                    '/admin/leaves', 
                    false
                );
            END LOOP;
        END IF;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
            INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
            VALUES (NEW.user_id, 'leave_cancel_approved', '取消請假已批准', '您的取消請假申請已通過審核', '/leaves', false);
            
        ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
            VALUES (NEW.user_id, 'leave_cancel_rejected', '取消請假被退回', '您的取消請假申請被退回', '/leaves', false);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_leave_cancellation_changed ON public.leave_cancellations;

CREATE TRIGGER on_leave_cancellation_changed
    AFTER INSERT OR UPDATE ON public.leave_cancellations
    FOR EACH ROW
    EXECUTE FUNCTION handle_leave_cancellation_notifications();
