-- 建立特休假餘額表
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_days DECIMAL(5, 2) DEFAULT 0,
    used_days DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year)
);

-- 建立索引
CREATE INDEX idx_leave_balances_user_year ON public.leave_balances(user_id, year);

-- 啟用 RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Policy: 使用者可以查看自己的餘額
CREATE POLICY "Users view own leave balances" ON public.leave_balances
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: 管理員可以查看所有人的餘額
CREATE POLICY "Managers view all leave balances" ON public.leave_balances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('manager', 'super_admin')
        )
    );

-- Policy: 管理員可以管理餘額 (以防需要手動調整)
CREATE POLICY "Managers manage leave balances" ON public.leave_balances
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('manager', 'super_admin')
        )
    );
