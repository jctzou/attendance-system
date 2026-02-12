-- Add break_duration column to attendance table
ALTER TABLE "public"."attendance" ADD COLUMN "break_duration" numeric;

comment on column "public"."attendance"."break_duration" is 'The duration of break time taken in hours (e.g. 1.0, 1.5, 2.0). Default is null.';
