-- Gmail-driven task status changes are logged as inbox items (with Undo).
alter table public.studio_inbox_items drop constraint if exists studio_inbox_items_suggested_action_check;
alter table public.studio_inbox_items add constraint studio_inbox_items_suggested_action_check
  check (suggested_action in ('create_task','create_promise','approve_gate','update_payment','log_payment','new_lead','reply_owed','update_deadline','update_task_status','ignore'));
