alter table "public"."leaves" add column "days" numeric(4,1);

comment on column "public"."leaves"."days" is '請假天數 (最小單位 0.5 天)';
