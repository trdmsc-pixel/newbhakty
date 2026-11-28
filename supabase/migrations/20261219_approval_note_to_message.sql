-- A client's note written while approving a stage becomes a message on that stage (visible in Studio OS history + Messages).
create or replace function public.trg_approval_note_message() returns trigger language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_client uuid;
begin
  if new.actor = 'client' and new.entity_type = 'gate' and new.action like 'approved %' and nullif(btrim(coalesce(new.diff->>'comment', '')), '') is not null then
    select g.project_id, p.client_id into v_project, v_client from public.studio_gates g join public.studio_projects p on p.id = g.project_id where g.id = new.entity_id;
    if v_client is not null then
      insert into public.studio_portal_messages (client_id, project_id, gate_id, body, from_studio, author_name, via)
      values (v_client, v_project, new.entity_id, '✅ Approved — ' || (new.diff->>'comment'), false, new.actor_name, 'portal');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists approval_note_message on public.studio_activity_log;
create trigger approval_note_message after insert on public.studio_activity_log for each row execute function public.trg_approval_note_message();
